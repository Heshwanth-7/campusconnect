import express from 'express';
import helmet from 'helmet';
import { errorHandler } from './middleware/error-handler.ts';
import { requireClientOrigin } from './middleware/csrf.ts';
import { authRouter } from './routes/auth.ts';
import { eventsRouter } from './routes/events.ts';
import { healthRouter } from './routes/health.ts';

export const app = express();

app.use(helmet());
app.use(requireClientOrigin);
app.use(express.json({ limit: '16kb' }));
app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/events', eventsRouter);
app.use((_request, _response, next) => next({ status: 404 }));
app.use(errorHandler);
