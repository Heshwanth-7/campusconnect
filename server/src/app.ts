import { adminRouter } from './routes/admin.ts';
import { feedRouter } from './routes/feed.ts';
import { notificationsRouter } from './routes/notifications.ts';
import express from 'express';
import { z } from 'zod';
import { db } from './utils/prisma.ts';
import { visibility } from './services/events.ts';
import helmet from 'helmet';
import { errorHandler } from './middleware/error-handler.ts';
import { requireClientOrigin } from './middleware/csrf.ts';
import { authRouter } from './routes/auth.ts';
import { eventsRouter } from './routes/events.ts';
import { registrationsRouter } from './routes/registrations.ts';
import { healthRouter } from './routes/health.ts';

import { checkinRouter } from './routes/checkin.ts';

import { postsRouter, matchesRouter } from './routes/lostfound.ts';
import { uploadDir } from './services/item-photo.ts';
import { requireAuth } from './middleware/require-auth.ts';

export const app = express();

app.use(helmet());
app.use(requireClientOrigin);
app.use(express.json({ limit: '16kb' }));
// Auth: campus item photos and posters of events visible to the viewer.
app.get('/uploads/:filename', requireAuth, async (req, res) => {
  const filename = z.string().regex(/^[a-f0-9-]{36}\.(jpg|png|webp)$/).parse(req.params.filename);
  const path = '/uploads/' + filename;
  const item = await db().lostFoundPost.findFirst({ where: { imagePath: path }, select: { id: true } });
  if (!item) {
    const event = await db().event.findFirst({
      where: { ...visibility(res.locals.user), posterImagePath: path }, select: { id: true },
    });
    if (!event) return res.sendStatus(404);
  }
  res.sendFile(filename, { root: uploadDir, cacheControl: false });
});
app.use('/api/admin', adminRouter);
app.use('/api/lostfound', postsRouter);
app.use('/api/matches', matchesRouter);
app.use('/api', feedRouter);
app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/checkin', checkinRouter);
app.use('/api/events', eventsRouter);
app.use('/api/registrations', registrationsRouter);
app.use('/api/notifications', notificationsRouter);
app.use((_request, _response, next) => next({ status: 404 }));
app.use(errorHandler);
