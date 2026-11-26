import express from 'express';
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
// Auth: signed-in students can view item photos. Helmet sets X-Content-Type-Options: nosniff.
app.use('/uploads', requireAuth, express.static(uploadDir, { index: false, cacheControl: false }));
app.use('/api/lostfound', postsRouter);
app.use('/api/matches', matchesRouter);
app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/checkin', checkinRouter);
app.use('/api/events', eventsRouter);
app.use('/api/registrations', registrationsRouter);
app.use((_request, _response, next) => next({ status: 404 }));
app.use(errorHandler);
