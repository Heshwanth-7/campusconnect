import { db } from '../utils/prisma.ts';
import { HttpError } from '../utils/http-error.ts';
import { signTicket, verifyTicket } from '../utils/qr-token.ts';

const hour = 3_600_000;

export async function getTicket(id: string, userId: string) {
  const row = await db().registration.findFirst({
    where: { id, userId }, include: { event: { select: { title: true, startsAt: true, endsAt: true } },
      user: { select: { name: true } } },
  });
  if (!row) throw new HttpError(404, 'Registration not found.');
  if (row.status !== 'CONFIRMED' || !row.qrNonce) throw new HttpError(409, 'A confirmed registration is required.');
  const token = signTicket({ registrationId: id, eventId: row.eventId, nonce: row.qrNonce,
    expiresAt: row.event.endsAt.getTime() + hour });
  return { token, event: row.event, studentName: row.user.name };
}

export async function checkIn(token: string, eventId: string) {
  const ticket = verifyTicket(token);
  if (!ticket) return { result: 'INVALID' };
  if (ticket.expiresAt <= Date.now()) return { result: 'EXPIRED' };
  if (ticket.eventId !== eventId) return { result: 'WRONG_EVENT' };

  const where = { id: ticket.registrationId, eventId };
  const row = await db().registration.findFirst({ where, select: {
    status: true, qrNonce: true, checkedInAt: true, event: { select: { endsAt: true } }, user: { select: { name: true } },
  } });
  if (!row) return { result: 'INVALID' };
  if (row.status !== 'CONFIRMED') return { result: 'NOT_CONFIRMED' };
  if (row.qrNonce !== ticket.nonce) return { result: 'INVALID' };
  const now = new Date();
  if (Math.min(ticket.expiresAt, row.event.endsAt.getTime() + hour) <= now.getTime()) return { result: 'EXPIRED' };
  if (row.checkedInAt) return { result: 'ALREADY_USED' };

  const { count } = await db().registration.updateMany({
    where: { ...where, status: 'CONFIRMED', qrNonce: ticket.nonce, checkedInAt: null },
    data: { checkedInAt: now },
  });
  if (count === 1) return { result: 'SUCCESS', studentName: row.user.name };

  // A cancellation or a new confirmation can also win the race with this scan.
  const latest = await db().registration.findFirst({ where });
  if (latest && latest.status !== 'CONFIRMED') return { result: 'NOT_CONFIRMED' };
  return { result: latest?.qrNonce === ticket.nonce && latest.checkedInAt ? 'ALREADY_USED' : 'INVALID' };
}

export async function attendance(eventId: string) {
  const registrations = await db().registration.findMany({
    where: { eventId, status: 'CONFIRMED' }, orderBy: [{ user: { name: 'asc' } }, { id: 'asc' }],
    select: { id: true, user: { select: { name: true } }, checkedInAt: true },
  });
  return { registered: registrations.length, checkedIn: registrations.filter(row => row.checkedInAt).length, registrations };
}
