import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { requireAuth } from '../middleware/require-auth.ts';
import * as auth from '../services/auth.ts';
import { clearAuthCookies, readRefreshCookie, setAuthCookies } from '../utils/auth-cookies.ts';
import { opaqueToken } from '../utils/auth-tokens.ts';
import { HttpError } from '../utils/http-error.ts';
import { emailInput, loginInput, registrationInput, resetInput, verificationInput } from '../validators/auth.ts';

export const authRouter = Router();

authRouter.use((_request, response, next) => {
  response.set('Cache-Control', 'no-store');
  next();
});
authRouter.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === 'test' ? 10_000 : 100,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_request, _response, next) => next(new HttpError(429, 'Too many requests. Try again later.')),
}));

// Auth: public.
authRouter.post('/register', async (request, response) => {
  await auth.register(registrationInput.parse(request.body));
  response.status(201).json({ message: 'Check your email to verify your account.' });
});

// Auth: public. The token proves control of the email address.
authRouter.post('/verify-email', async (request, response) => {
  await auth.verifyEmail(verificationInput.parse(request.body).token);
  response.json({ message: 'Email verified.' });
});

// Auth: public.
authRouter.post('/resend-verification', async (request, response) => {
  await auth.requestAuthEmail(emailInput.parse(request.body).email, 'verify-email');
  response.json({ message: 'If the account needs verification, an email will be sent.' });
});

// Auth: public.
authRouter.post('/login', async (request, response) => {
  const { email, password } = loginInput.parse(request.body);
  setAuthCookies(response, await auth.login(email, password));
  response.status(204).end();
});

// Auth: refresh cookie required.
authRouter.post('/refresh', async (request, response) => {
  const token = opaqueToken.safeParse(readRefreshCookie(request));
  try {
    if (!token.success) throw new HttpError(401, 'Invalid refresh token.');
    setAuthCookies(response, await auth.refreshSession(token.data));
    response.status(204).end();
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) clearAuthCookies(response);
    throw error;
  }
});

// Auth: optional refresh cookie so signing out is idempotent.
authRouter.post('/logout', async (request, response) => {
  const token = opaqueToken.safeParse(readRefreshCookie(request));
  if (token.success) await auth.logout(token.data);
  clearAuthCookies(response);
  response.status(204).end();
});

// Auth: public.
authRouter.post('/forgot-password', async (request, response) => {
  await auth.requestAuthEmail(emailInput.parse(request.body).email, 'reset-password');
  response.json({ message: 'If the account exists, a password reset email will be sent.' });
});

// Auth: public. A single-use reset token is required to change the password.
authRouter.post('/reset-password', async (request, response) => {
  const { token, password } = resetInput.parse(request.body);
  await auth.resetPassword(token, password);
  response.json({ message: 'If the reset token was valid, the password has been changed.' });
});

// Auth: authenticated user, any role.
authRouter.get('/me', requireAuth, (_request, response) => {
  response.json({ user: response.locals.user });
});
