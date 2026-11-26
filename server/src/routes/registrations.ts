import { eventId } from '../validators/events.ts';
import { getTicket } from '../services/checkin.ts';
import { Router } from 'express';
import { requireAuth } from '../middleware/require-auth.ts';
import { myRegistrations } from '../services/registration.service.ts';

export const registrationsRouter = Router();

// Auth: any authenticated user, limited to their own registrations.
registrationsRouter.get('/mine', requireAuth, async (_request, response) => {
  response.json({ registrations: await myRegistrations(response.locals.user.id) });
});

// Auth: only the registration owner.
registrationsRouter.get('/:id/qr', requireAuth, async (request, response) => {
  response.set('Cache-Control', 'no-store').json(await getTicket(eventId.parse(request.params.id), response.locals.user.id));
});
