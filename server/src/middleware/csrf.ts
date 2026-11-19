import type { RequestHandler } from 'express';
import { HttpError } from '../utils/http-error.ts';

export const requireClientOrigin: RequestHandler = (request, _response, next) => {
  if (request.method === 'GET') return next();

  // Browsers attach cookies automatically. Checking the source stops other sites
  // from using those cookies to make changes on the student's behalf.
  const origin = request.get('Origin');
  const referer = request.get('Referer');
  let source = origin;
  try {
    if (origin === undefined && referer) source = new URL(referer).origin;
  } catch {
    source = undefined;
  }

  const clientUrl = process.env.CLIENT_URL;
  if (!source || !clientUrl || source !== new URL(clientUrl).origin) {
    return next(new HttpError(403, 'Request origin is not allowed.'));
  }
  next();
};
