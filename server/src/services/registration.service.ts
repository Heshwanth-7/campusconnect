/*
 * Without a lock, two requests can both count the last seat as free and both
 * confirm it. FOR UPDATE locks the event row until the transaction finishes.
 * The next request waits, then counts again and sees the seats already taken.
 * Cancelling and changing capacity take the same lock before changing seats.
 */
import { Prisma } from '../generated/prisma/client.ts';
import type { Event, Registration, RegistrationStatus } from '../generated/prisma/client.ts';
import { HttpError } from '../utils/http-error.ts';
import { db } from '../utils/prisma.ts';

export const seatTransaction = {
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
  maxWait: 20_000,
  timeout: 30_000,
};

export async function lockEvent(tx: Prisma.TransactionClient, eventId: string) {
  const [event] = await tx.$queryRaw<Event[]>`SELECT * FROM "Event" WHERE id = ${eventId}::uuid FOR UPDATE`;
  if (!event) throw new HttpError(404, 'Event not found.');
  return event;
}

const queueOrder = [{ queuedAt: 'asc' }, { id: 'asc' }] as const;
const queue = [...queueOrder];

export function confirmedCount(tx: Prisma.TransactionClient, eventId: string) {
  return tx.registration.count({ where: { eventId, status: 'CONFIRMED' } });
}

type Notice = { userId: string; type: 'confirmed' | 'waitlisted' | 'cancelled' | 'promoted'; eventId: string };

function notifyUser(userId: string, type: Notice['type'], payload: { eventId: string }) {
  console.log('Registration notification', userId, type, payload);
}

export function sendRegistrationNotices(notices: Notice[]) {
  for (const { userId, type, eventId } of notices) notifyUser(userId, type, { eventId });
}

export async function promoteWaitlist(tx: Prisma.TransactionClient, eventId: string, seats: number): Promise<Notice[]> {
  if (seats <= 0) return [];
  const waiting = await tx.registration.findMany({
    where: { eventId, status: 'WAITLISTED' },
    orderBy: queue,
    take: seats,
    select: { id: true, userId: true },
  });
  if (waiting.length) {
    await tx.registration.updateMany({
      where: { id: { in: waiting.map(({ id }) => id) } },
      data: { status: 'CONFIRMED' },
    });
  }
  return waiting.map(({ userId }) => ({ userId, type: 'promoted', eventId }));
}

type RegistrationSummary = {
  eventId: string;
  seatsLeft: number;
  myRegistrationStatus: RegistrationStatus | null;
  myWaitlistPosition: number | null;
};

export async function registrationSummaries(eventIds: string[], userId: string, tx: Prisma.TransactionClient = db()) {
  if (!eventIds.length) return new Map<string, RegistrationSummary>();
  const ids = Prisma.join(eventIds.map((id) => Prisma.sql`${id}::uuid`));
  const rows = await tx.$queryRaw<RegistrationSummary[]>`
    SELECT e.id AS "eventId",
      e.capacity - (SELECT count(*)::int FROM "Registration" r
        WHERE r."eventId" = e.id AND r.status = 'CONFIRMED') AS "seatsLeft",
      mine.status AS "myRegistrationStatus",
      CASE WHEN mine.status = 'WAITLISTED' THEN
        (SELECT count(*)::int FROM "Registration" r
          WHERE r."eventId" = e.id AND r.status = 'WAITLISTED'
            AND (r."queuedAt", r.id) <= (mine."queuedAt", mine.id))
      END AS "myWaitlistPosition"
    FROM "Event" e
    LEFT JOIN "Registration" mine ON mine."eventId" = e.id AND mine."userId" = ${userId}::uuid
    WHERE e.id IN (${ids})
  `;
  return new Map(rows.map((row) => [row.eventId, row]));
}

async function resultFor(tx: Prisma.TransactionClient, registration: Registration) {
  const summaries = await registrationSummaries([registration.eventId], registration.userId, tx);
  return { registration, ...summaries.get(registration.eventId)! };
}

export async function register(userId: string, eventId: string) {
  const result = await db().$transaction(async (tx) => {
    const event = await lockEvent(tx, eventId);
    if (event.status !== 'APPROVED' || event.startsAt <= new Date()) {
      throw new HttpError(409, 'Registration is closed for this event.');
    }
    const where = { userId_eventId: { userId, eventId } };
    const previous = await tx.registration.findUnique({ where });
    if (previous && previous.status !== 'CANCELLED') {
      throw new HttpError(409, 'You already have an active registration.');
    }
    const count = await confirmedCount(tx, eventId);
    const status = count < event.capacity ? 'CONFIRMED' : 'WAITLISTED';
    const registration = await tx.registration.upsert({
      where, create: { userId, eventId, status }, update: { status, cancelledAt: null },
    });
    if (!previous && status === 'CONFIRMED') return resultFor(tx, registration);

    // Use the database clock. If it ties or moves backwards, append after the current tail.
    const [queued] = await tx.$queryRaw<Registration[]>`
      UPDATE "Registration" SET "queuedAt" = GREATEST(clock_timestamp(), (
        SELECT "queuedAt" + interval '1 microsecond'
        FROM "Registration"
        WHERE "eventId" = ${eventId}::uuid AND status = 'WAITLISTED'
          AND id <> ${registration.id}::uuid AND ${status} = 'WAITLISTED'
        ORDER BY "queuedAt" DESC, id DESC LIMIT 1
      ))
      WHERE id = ${registration.id}::uuid RETURNING *
    `;
    return resultFor(tx, queued);
  }, seatTransaction);
  sendRegistrationNotices([{ userId, eventId, type: result.registration.status === 'CONFIRMED' ? 'confirmed' : 'waitlisted' }]);
  return result;
}

export async function cancel(userId: string, eventId: string) {
  const { result, notices } = await db().$transaction(async (tx) => {
    await lockEvent(tx, eventId);
    const where = { userId_eventId: { userId, eventId } };
    const previous = await tx.registration.findUnique({ where });
    if (!previous || previous.status === 'CANCELLED') {
      throw new HttpError(409, 'You have no active registration for this event.');
    }
    const registration = await tx.registration.update({
      where, data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    const notices: Notice[] = [{ userId, eventId, type: 'cancelled' }];
    if (previous.status === 'CONFIRMED') notices.push(...await promoteWaitlist(tx, eventId, 1));
    return { result: await resultFor(tx, registration), notices };
  }, seatTransaction);
  sendRegistrationNotices(notices);
  return result;
}

export async function myRegistrations(userId: string) {
  const registrations = await db().registration.findMany({
    where: { userId },
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    include: { event: { select: { id: true, title: true, startsAt: true, venue: true } } },
  });
  const summaries = await registrationSummaries(registrations.map(({ eventId }) => eventId), userId);
  return registrations.flatMap((registration) => {
    const summary = summaries.get(registration.eventId);
    return summary ? [{
      ...registration, status: summary.myRegistrationStatus ?? registration.status,
      waitlistPosition: summary.myWaitlistPosition,
    }] : [];
  });
}

export async function eventRegistrations(eventId: string, user: { id: string; role: string }) {
  const event = await db().event.findUnique({ where: { id: eventId }, select: { organizerId: true } });
  if (!event) throw new HttpError(404, 'Event not found.');
  if (user.role !== 'ADMIN' && (user.role !== 'ORGANIZER' || event.organizerId !== user.id)) {
    throw new HttpError(403, 'Only the event organizer or an admin can view registrations.');
  }
  const registrations = await db().registration.findMany({
    where: { eventId }, orderBy: queue, include: { user: { select: { id: true, name: true } } },
  });
  const counts = { CONFIRMED: 0, WAITLISTED: 0, CANCELLED: 0 };
  const rows = registrations.map((row) => {
    const count = ++counts[row.status];
    return { ...row, waitlistPosition: row.status === 'WAITLISTED' ? count : null };
  });
  return { registrations: rows, counts };
}
