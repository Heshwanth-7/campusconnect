import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/require-auth.ts';
import * as events from '../services/events.ts';
import { eventCreate, eventId, eventPatch, eventQuery } from '../validators/events.ts';

export const eventsRouter = Router();

// Auth: every events endpoint requires a signed-in user.
eventsRouter.use(requireAuth);

// Auth: organizer or admin.
eventsRouter.post('/', requireRole('ORGANIZER', 'ADMIN'), async (request, response) => {
  const event = await events.createEvent(response.locals.user, eventCreate.parse(request.body));
  response.status(201).json({ event });
});

// Auth: any authenticated user, filtered by visibility.
eventsRouter.get('/', async (request, response) => {
  response.json(await events.listEvents(response.locals.user, eventQuery.parse(request.query), false));
});

// Auth: any authenticated user, limited to their own events.
eventsRouter.get('/mine', async (request, response) => {
  response.json(await events.listEvents(response.locals.user, eventQuery.parse(request.query), true));
});

// Auth: any authenticated user with visibility of the event.
eventsRouter.get('/:id', async (request, response) => {
  const event = await events.getEvent(response.locals.user, eventId.parse(request.params.id));
  response.json({ event });
});

// Auth: event owner or admin.
eventsRouter.patch('/:id', async (request, response) => {
  const event = await events.updateEvent(response.locals.user, eventId.parse(request.params.id), eventPatch.parse(request.body));
  response.json({ event });
});

// Auth: event owner or admin.
eventsRouter.delete('/:id', async (request, response) => {
  await events.deleteEvent(response.locals.user, eventId.parse(request.params.id));
  response.status(204).end();
});
