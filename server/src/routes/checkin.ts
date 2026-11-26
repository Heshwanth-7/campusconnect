import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/require-auth.ts';
import { requireEventManager } from '../services/registration.service.ts';
import { checkIn } from '../services/checkin.ts';

export const checkinRouter = Router();
const scan = z.strictObject({ token: z.string(), eventId: z.uuid() });

// Auth: the organizer who owns the scanner event, or an admin.
checkinRouter.post('/', requireAuth, requireRole('ORGANIZER', 'ADMIN'), async (request, response) => {
  const { token, eventId } = scan.parse(request.body);
  await requireEventManager(eventId, response.locals.user);
  response.json(await checkIn(token, eventId));
});
