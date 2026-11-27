import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/require-auth.ts';
import { db } from '../utils/prisma.ts';
import { HttpError } from '../utils/http-error.ts';

export const notificationsRouter = Router();
// Auth: every notification endpoint is restricted to its signed-in owner.
notificationsRouter.use(requireAuth);
const pagination = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

notificationsRouter.get('/', async (req, res) => {
  const { page, pageSize } = pagination.parse(req.query);
  const rows = await db().notification.findMany({
    where: { userId: res.locals.user.id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    skip: (page - 1) * pageSize, take: pageSize + 1,
    select: { id: true, type: true, title: true, message: true, linkPath: true, readAt: true, createdAt: true },
  });
  res.json({ notifications: rows.slice(0, pageSize), page, hasMore: rows.length > pageSize });
});

notificationsRouter.get('/unread-count', async (_req, res) => {
  res.json({ count: await db().notification.count({ where: { userId: res.locals.user.id, readAt: null } }) });
});

notificationsRouter.post('/read-all', async (_req, res) => {
  await db().notification.updateMany({ where: { userId: res.locals.user.id, readAt: null }, data: { readAt: new Date() } });
  res.sendStatus(204);
});

notificationsRouter.post('/:id/read', async (req, res) => {
  const where = { id: z.uuid().parse(req.params.id), userId: res.locals.user.id };
  const { count } = await db().notification.updateMany({ where: { ...where, readAt: null }, data: { readAt: new Date() } });
  if (!count && !await db().notification.count({ where })) throw new HttpError(404, 'Notification not found.');
  res.sendStatus(204);
});
