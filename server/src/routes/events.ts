import { attendance } from '../services/checkin.ts';
import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/require-auth.ts';
import { cancel, eventRegistrations, requireEventManager, register } from '../services/registration.service.ts';
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

// Auth: any authenticated user may register or cancel their own registration.
eventsRouter.post('/:id/register', async (request, response) => {
  response.status(201).json(await register(response.locals.user.id, eventId.parse(request.params.id)));
});

eventsRouter.delete('/:id/register', async (request, response) => {
  response.json(await cancel(response.locals.user.id, eventId.parse(request.params.id)));
});

// Auth: the owning organizer or an admin.
eventsRouter.get('/:id/registrations', requireRole('ORGANIZER', 'ADMIN'), async (request, response) => {
  response.json(await eventRegistrations(eventId.parse(request.params.id), response.locals.user));
});

// Auth: the owning organizer or an admin.
eventsRouter.get('/:id/attendance', requireRole('ORGANIZER', 'ADMIN'), async (request, response) => {
  const id = eventId.parse(request.params.id);
  await requireEventManager(id, response.locals.user);
  response.set('Cache-Control', 'no-store').json(await attendance(id));
});
