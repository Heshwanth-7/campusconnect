import type { RequestHandler } from 'express';
import type { Role } from '../generated/prisma/enums.ts';
import { readAccessCookie } from '../utils/auth-cookies.ts';
import { accessTokenUserId } from '../utils/auth-tokens.ts';
import { HttpError } from '../utils/http-error.ts';
import { db } from '../utils/prisma.ts';

export const publicUserFields = {
  id: true,
  name: true,
  email: true,
  role: true,
  emailVerifiedAt: true,
  createdAt: true,
} as const;

export const requireAuth: RequestHandler = async (request, response, next) => {
  const token = readAccessCookie(request);
  const userId = token && accessTokenUserId(token);
  if (!userId) throw new HttpError(401, 'Authentication required.');

  const user = await db().user.findUnique({
    where: { id: userId },
    select: { ...publicUserFields, blockedAt: true },
  });
  if (!user || !user.emailVerifiedAt) throw new HttpError(401, 'Authentication required.');
  if (user.blockedAt) throw new HttpError(403, 'Account is blocked.');

  const { blockedAt: _blockedAt, ...publicUser } = user;
  response.locals.user = publicUser;
  next();
};

export function requireRole(...roles: Role[]): RequestHandler {
  return (_request, response, next) => {
    const user = response.locals.user as { role: Role } | undefined;
    if (!user) throw new HttpError(401, 'Authentication required.');
    if (!roles.includes(user.role)) throw new HttpError(403, 'Insufficient permissions.');
    next();
  };
}
