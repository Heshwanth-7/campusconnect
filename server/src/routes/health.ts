import { Router } from 'express';

export const healthRouter = Router();

// Auth: public.
healthRouter.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});
