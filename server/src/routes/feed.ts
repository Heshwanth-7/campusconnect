import { Router } from 'express';
import { z } from 'zod';
import { publicUserFields, requireAuth } from '../middleware/require-auth.ts';
import { getFeed } from '../services/feed.service.ts';
import { INTERESTS } from '../utils/event-constants.ts';
import { db } from '../utils/prisma.ts';

export const feedRouter = Router();
const preferences = z.strictObject({
  interests: z.array(z.enum(INTERESTS)).max(INTERESTS.length).transform(values => [...new Set(values)]),
});

// Auth: signed-in users can edit their own preferences.
feedRouter.patch('/users/me/interests', requireAuth, async (request, response) => {
  const { interests } = preferences.parse(request.body);
  const user = await db().user.update({
    where: { id: response.locals.user.id }, data: { interests, interestsOnboarded: true }, select: publicUserFields,
  });
  response.json({ user });
});

// Auth: signed-in users receive their own feed.
feedRouter.get('/feed', requireAuth, async (_request, response) => {
  response.set('Cache-Control', 'private, no-store').json({ events: await getFeed(response.locals.user) });
});
