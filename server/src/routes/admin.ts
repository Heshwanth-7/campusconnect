import { Router } from 'express';
import { z } from 'zod';
import { EventStatus, Role } from '../generated/prisma/enums.ts';
import { requireAuth, requireRole } from '../middleware/require-auth.ts';
import { changeUser, getStats, moderate } from '../services/admin.ts';
import { deleteEvent } from '../services/events.ts';
import { deletePost } from '../services/lostfound.ts';
import { removePhoto } from '../services/item-photo.ts';
import { db } from '../utils/prisma.ts';

export const adminRouter = Router();
// Auth: every route in this router requires a verified, active administrator.
adminRouter.use(requireAuth, requireRole('ADMIN'), (_req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  next();
});

const paging = z.strictObject({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
const eventQuery = paging.extend({ status: z.enum(EventStatus).optional() });
const userQuery = paging.extend({ search: z.string().trim().max(160).optional() });
const auditQuery = paging.extend({ action: z.string().trim().min(1).max(64).optional(), actor: z.uuid().optional() });
const orderBy = [{ createdAt: 'desc' }, { id: 'desc' }] as const;
function slice(page: number, pageSize: number) {
  return { skip: (page - 1) * pageSize, take: pageSize + 1, orderBy: [...orderBy] };
}
function result<T>(rows: T[], page: number, pageSize: number) {
  return { rows: rows.slice(0, pageSize), page, hasMore: rows.length > pageSize };
}

adminRouter.get('/stats', async (_req, res) => res.json(await getStats()));
adminRouter.get('/events', async (req, res) => {
  const { status, page, pageSize } = eventQuery.parse(req.query);
  const rows = await db().event.findMany({ where: { status }, ...slice(page, pageSize),
    select: { id: true, title: true, clubName: true, status: true, startsAt: true, venue: true } });
  res.json(result(rows, page, pageSize));
});
for (const decision of ['approve', 'reject']) {
  adminRouter.post('/events/:id/' + decision, async (req, res) => {
    const reason = decision === 'reject' ? z.strictObject({ reason: z.string().trim().min(1).max(1000) }).parse(req.body).reason : null;
    res.json({ event: await moderate(res.locals.user.id, z.uuid().parse(req.params.id), reason) });
  });
}
adminRouter.delete('/events/:id', async (req, res) => {
  await deleteEvent(res.locals.user, z.uuid().parse(req.params.id));
  res.sendStatus(204);
});
adminRouter.delete('/lostfound/:id', async (req, res) => {
  await removePhoto(await deletePost(z.uuid().parse(req.params.id), res.locals.user));
  res.sendStatus(204);
});
adminRouter.get('/users', async (req, res) => {
  const { search, page, pageSize } = userQuery.parse(req.query);
  const term = { contains: search?.replace(/[\\%_]/g, '\\$&'), mode: 'insensitive' } as const;
  const rows = await db().user.findMany({ where: search ? { OR: [{ name: term }, { email: term }] } : {},
    select: { id: true, name: true, email: true, role: true, blockedAt: true }, ...slice(page, pageSize) });
  res.json(result(rows, page, pageSize));
});
adminRouter.patch('/users/:id/role', async (req, res) => {
  const body = z.strictObject({ role: z.enum(Role) }).parse(req.body);
  await changeUser(res.locals.user.id, z.uuid().parse(req.params.id), body);
  res.sendStatus(204);
});
for (const change of ['block', 'unblock'] as const) {
  adminRouter.post('/users/:id/' + change, async (req, res) => {
    await changeUser(res.locals.user.id, z.uuid().parse(req.params.id), change);
    res.sendStatus(204);
  });
}
adminRouter.get('/audit-log', async (req, res) => {
  const { action, actor, page, pageSize } = auditQuery.parse(req.query);
  const rows = await db().auditLog.findMany({ where: { action, actorId: actor }, ...slice(page, pageSize) });
  const actors = await db().user.findMany({
    where: { id: { in: [...new Set(rows.map(row => row.actorId))] } }, select: { id: true, name: true },
  });
  const names = new Map(actors.map(user => [user.id, user.name]));
  res.json(result(rows.map(row => ({ ...row, actorName: names.get(row.actorId) ?? null })), page, pageSize));
});
