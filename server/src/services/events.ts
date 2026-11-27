import type { Request } from 'express';
import { removePhoto, savePhoto } from './item-photo.ts';
import type { Event, Prisma, Role } from '../generated/prisma/client.ts';
import type { z } from 'zod';
import { HttpError } from '../utils/http-error.ts';
import { db } from '../utils/prisma.ts';
import { confirmedCount, lockEvent, promoteWaitlist, registrationSummaries, seatTransaction, sendRegistrationNotices } from './registration.service.ts';
import type { eventCreate, eventPatch, eventQuery } from '../validators/events.ts';

type Actor = { id: string; role: Role };
type Query = z.output<typeof eventQuery>;
type Fields = z.output<typeof eventCreate>;
type Patch = z.output<typeof eventPatch>;

async function withSeats(events: Event[], userId: string, tx?: Prisma.TransactionClient) {
  const summaries = await registrationSummaries(events.map(({ id }) => id), userId, tx);
  return events.flatMap((event) => {
    const summary = summaries.get(event.id);
    if (!summary) return [];
    const { seatsLeft, myRegistrationStatus, myWaitlistPosition } = summary;
    return [{ ...event, seatsLeft, myRegistrationStatus, myWaitlistPosition }];
  });
}

function visibility(actor: Actor): Prisma.EventWhereInput {
  if (actor.role === 'ADMIN') return {};
  return { OR: [{ organizerId: actor.id }, { status: 'APPROVED', startsAt: { gte: new Date() } }] };
}

function checkTimes(startsAt: Date, endsAt: Date) {
  if (endsAt <= startsAt) throw new HttpError(400, 'End time must be after start time.');
}

export async function createEvent(actor: Actor, fields: Fields) {
  checkTimes(fields.startsAt, fields.endsAt);
  const event = await db().event.create({
    data: { ...fields, organizerId: actor.id, status: actor.role === 'ADMIN' ? 'APPROVED' : 'PENDING' },
  });
  return (await withSeats([event], actor.id))[0];
}

export async function listEvents(actor: Actor, query: Query, mine: boolean) {
  const { q, category, from, to, page, pageSize } = query;
  const where: Prisma.EventWhereInput = {
    AND: [
      mine ? { organizerId: actor.id } : visibility(actor),
      {
        category,
        startsAt: { gte: from, lte: to },
        ...(q && {
          OR: (['title', 'description', 'clubName'] as const).map((field) => ({
            [field]: { contains: q.replace(/[\\%_]/g, '\\$&'), mode: 'insensitive' },
          })),
        }),
      },
    ],
  };
  const rows = await db().event.findMany({
    where,
    orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
    skip: (page - 1) * pageSize,
    take: pageSize + 1,
  });
  return { events: await withSeats(rows.slice(0, pageSize), actor.id), page, pageSize, hasMore: rows.length > pageSize };
}

export async function getEvent(actor: Actor, id: string) {
  const event = await db().event.findFirst({ where: { id, ...visibility(actor) } });
  const [result] = event ? await withSeats([event], actor.id) : [];
  if (!result) throw new HttpError(404, 'Event not found.');
  return result;
}

function reviewFieldsChanged(event: Event, patch: Patch) {
  return Object.entries(patch).some(([key, value]) => {
    const previous = event[key as keyof Fields];
    if (value instanceof Date && previous instanceof Date) return value.getTime() !== previous.getTime();
    if (Array.isArray(value) && Array.isArray(previous)) {
      return value.length !== previous.length || value.some((tag) => !previous.includes(tag));
    }
    return value !== previous;
  });
}

async function lockOwnedEvent(tx: Prisma.TransactionClient, actor: Actor, id: string) {
  const event = await lockEvent(tx, id);
  if (actor.role !== 'ADMIN' && event.organizerId !== actor.id) {
    if (event.status !== 'APPROVED' || event.startsAt < new Date()) throw new HttpError(404, 'Event not found.');
    throw new HttpError(403, 'Only the owner or an admin can manage this event.');
  }
  return event;
}

export async function updateEvent(actor: Actor, id: string, patch: Patch) {
  const { event, notices } = await db().$transaction(async (tx) => {
    const current = await lockOwnedEvent(tx, actor, id);
    checkTimes(patch.startsAt ?? current.startsAt, patch.endsAt ?? current.endsAt);
    const needsReview = actor.role !== 'ADMIN' && current.status === 'APPROVED' && reviewFieldsChanged(current, patch);
    const capacity = patch.capacity ?? current.capacity;
    const confirmed = capacity !== current.capacity ? await confirmedCount(tx, id) : 0;
    if (capacity < confirmed) {
      throw new HttpError(409, 'Capacity cannot be lower than the confirmed registration count.');
    }
    const event = await tx.event.update({
      where: { id },
      data: { ...patch, ...(needsReview && { status: 'PENDING', rejectionReason: null }) },
    });
    const notices = event.capacity > current.capacity ? await promoteWaitlist(tx, id, event.capacity - confirmed) : [];
    const [result] = await withSeats([event], actor.id, tx);
    return { event: result, notices };
  }, seatTransaction);
  sendRegistrationNotices(notices);
  return event;
}

export async function deleteEvent(actor: Actor, id: string) {
  const deleted = await db().$transaction(async (tx) => {
    await lockOwnedEvent(tx, actor, id);
    return tx.event.delete({ where: { id } });
  }, seatTransaction);
  await removePhoto(deleted.posterImagePath);
}

export async function changePoster(actor: Actor, id: string, upload?: Request) {
  let newPath: string | null = null;
  const previousPath = await db().$transaction(async tx => {
    const event = await lockOwnedEvent(tx, actor, id);
    if (upload) {
      newPath = await savePhoto(upload);
      if (!newPath) throw new HttpError(400, 'Choose a poster to upload.');
    }
    if (event.posterImagePath !== newPath) {
      const needsReview = actor.role !== 'ADMIN' && event.status === 'APPROVED';
      await tx.event.update({ where: { id }, data: {
        posterImagePath: newPath, ...(needsReview && { status: 'PENDING', rejectionReason: null }),
      } });
    }
    return event.posterImagePath;
  }, seatTransaction).catch(async error => {
    await removePhoto(newPath);
    throw error;
  });
  await removePhoto(previousPath);
  return newPath;
}
