import type { ErrorRequestHandler } from 'express';
import { HttpError } from '../utils/http-error.ts';
import { z } from 'zod';

const errorStatus = z.object({
  status: z.number().int().min(400).max(599),
});

const messages: Record<number, string> = {
  400: 'Invalid request.',
  404: 'Route not found.',
  413: 'Request body is too large.',
  415: 'Unsupported request format.',
};

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  const parsed = errorStatus.safeParse(error);
  const status = error instanceof z.ZodError ? 400 : parsed.success ? parsed.data.status : 500;
  const message = (error instanceof HttpError ? error.message : messages[status]) ?? (status >= 500 ? 'Internal server error.' : 'Request failed.');

  const details = error instanceof HttpError ? error.details : undefined;
  response.status(status).json({ error: { status, message, ...details } });
};
