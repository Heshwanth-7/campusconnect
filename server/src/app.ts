import express from 'express';
import helmet from 'helmet';
import { errorHandler } from './middleware/error-handler.ts';
import { healthRouter } from './routes/health.ts';

export const app = express();

app.use(helmet());
app.use(express.json({ limit: '16kb' }));
app.use('/api', healthRouter);
app.use((_request, _response, next) => next({ status: 404 }));
app.use(errorHandler);
