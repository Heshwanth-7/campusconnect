import type { Event, Prisma, Role } from '../generated/prisma/client.ts';
import type { z } from 'zod';
import { HttpError } from '../utils/http-error.ts';
import { db } from '../utils/prisma.ts';
import type { eventCreate, eventPatch, eventQuery } from '../validators/events.ts';

type Actor = { id: string; role: Role };
type Query = z.output<typeof eventQuery>;
type Fields = z.output<typeof eventCreate>;
type Patch = z.output<typeof eventPatch>;

function withSeats(event: Event) {
  return { ...event, seatsLeft: event.capacity };
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
  return withSeats(event);
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
  return { events: rows.slice(0, pageSize).map(withSeats), page, pageSize, hasMore: rows.length > pageSize };
}

export async function getEvent(actor: Actor, id: string) {
  const event = await db().event.findFirst({ where: { id, ...visibility(actor) } });
  if (!event) throw new HttpError(404, 'Event not found.');
  return withSeats(event);
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
  // Lock the current row so parallel edits validate the same start/end pair they update.
  await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${id}::uuid FOR UPDATE`;
  const event = await tx.event.findUnique({ where: { id } });
  if (!event) throw new HttpError(404, 'Event not found.');
  if (actor.role !== 'ADMIN' && event.organizerId !== actor.id) {
    if (event.status !== 'APPROVED' || event.startsAt < new Date()) throw new HttpError(404, 'Event not found.');
    throw new HttpError(403, 'Only the owner or an admin can manage this event.');
  }
  return event;
}

export async function updateEvent(actor: Actor, id: string, patch: Patch) {
  return db().$transaction(async (tx) => {
    const current = await lockOwnedEvent(tx, actor, id);
    checkTimes(patch.startsAt ?? current.startsAt, patch.endsAt ?? current.endsAt);
    const needsReview = actor.role !== 'ADMIN' && current.status === 'APPROVED' && reviewFieldsChanged(current, patch);
    return withSeats(await tx.event.update({
      where: { id },
      data: { ...patch, ...(needsReview && { status: 'PENDING', rejectionReason: null }) },
    }));
  });
}

export async function deleteEvent(actor: Actor, id: string) {
  await db().$transaction(async (tx) => {
    await lockOwnedEvent(tx, actor, id);
    await tx.event.delete({ where: { id } });
  });
}
