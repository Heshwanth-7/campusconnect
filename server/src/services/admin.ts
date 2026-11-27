import type { Role } from '../generated/prisma/client.ts';
import { HttpError } from '../utils/http-error.ts';
import { db } from '../utils/prisma.ts';
import { audit } from './audit.ts';
import { notifyUser } from './notify-user.ts';
import { lockEvent } from './registration.service.ts';

export async function getStats() {
  const [users, events, registrations, posts] = await db().$transaction([
    db().user.count(),
    db().event.groupBy({ by: ['status'], _count: true }),
    db().registration.aggregate({ _count: { id: true, checkedInAt: true } }),
    db().lostFoundPost.groupBy({ by: ['status'], where: { status: { in: ['OPEN', 'MATCHED'] } }, _count: true }),
  ], { isolationLevel: 'RepeatableRead' });
  const eventsByStatus = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
  const lostFound = { OPEN: 0, MATCHED: 0 };
  for (const row of events) eventsByStatus[row.status] = row._count;
  for (const row of posts) if (row.status !== 'RESOLVED') lostFound[row.status] = row._count;
  return { users, events: eventsByStatus, registrations: registrations._count.id, checkIns: registrations._count.checkedInAt, lostFound };
}

export async function moderate(actorId: string, id: string, reason: string | null) {
  const status = reason === null ? 'APPROVED' : 'REJECTED';
  const action = reason === null ? 'EVENT_APPROVED' : 'EVENT_REJECTED';
  const event = await db().$transaction(async tx => {
    const current = await lockEvent(tx, id);
    if (current.status !== 'PENDING') throw new HttpError(409, 'This event has already been reviewed.');
    await audit(tx, actorId, action, 'Event', id, { title: current.title, reason });
    return tx.event.update({ where: { id }, data: { status, rejectionReason: reason } });
  });
  await notifyUser(event.organizerId, action, {
    message: reason === null ? `Your event “${event.title}” was approved.` : `Your event “${event.title}” was rejected. ${reason}`,
    linkPath: '/events/' + id,
  });
  return event;
}

export function protectAdminAccess(actorId: string, targetId: string, otherActiveAdmins: number) {
  if (otherActiveAdmins === 0) throw new HttpError(409, 'The last active administrator must retain access.');
  if (actorId === targetId) throw new HttpError(409, 'You cannot block or demote yourself.');
}

type UserChange = { role: Role } | 'block' | 'unblock';

export function changeUser(actorId: string, id: string, change: UserChange) {
  return db().$transaction(async tx => {
    // Serialize privilege changes, then recheck the actor after any competing request commits.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(143117, 2)`;
    const actor = await tx.user.findUnique({ where: { id: actorId } });
    if (actor?.role !== 'ADMIN' || actor.blockedAt) throw new HttpError(403, 'Administrator access required.');
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${id}::uuid FOR UPDATE`;
    const target = await tx.user.findUnique({ where: { id } });
    if (!target) throw new HttpError(404, 'User not found.');
    const removingAdmin = change === 'block' || (typeof change === 'object' && change.role !== 'ADMIN');
    if (removingAdmin && target.role === 'ADMIN' && !target.blockedAt) {
      const others = await tx.user.count({ where: { role: 'ADMIN', blockedAt: null, id: { not: id } } });
      protectAdminAccess(actorId, id, others);
    }
    if (typeof change === 'object') {
      await audit(tx, actorId, 'USER_ROLE_CHANGED', 'User', id, { previousRole: target.role, role: change.role });
      await tx.user.update({ where: { id }, data: change });
    } else {
      const blocking = change === 'block';
      const now = new Date();
      await audit(tx, actorId, blocking ? 'USER_BLOCKED' : 'USER_UNBLOCKED', 'User', id, { name: target.name });
      await tx.user.update({ where: { id }, data: { blockedAt: blocking ? target.blockedAt ?? now : null } });
      if (blocking) await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: now } });
    }
  }, { isolationLevel: 'ReadCommitted' });
}
