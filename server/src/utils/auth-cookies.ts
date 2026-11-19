import type { CookieOptions, Request, Response } from 'express';
import { accessLifetime, refreshLifetime } from './auth-tokens.ts';

const accessCookie = 'access_token';
const refreshCookie = 'refresh_token';

function cookieOptions(path: string): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path };
}

function readCookie(request: Request, name: string) {
  const prefix = `${name}=`;
  const match = request.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix));
  // Issued tokens use URL-safe characters and need no percent decoding.
  return match?.slice(prefix.length);
}

export function readAccessCookie(request: Request) {
  return readCookie(request, accessCookie);
}

export function readRefreshCookie(request: Request) {
  return readCookie(request, refreshCookie);
}

export function setAuthCookies(response: Response, session: { access: string; refresh: string }) {
  response.cookie(accessCookie, session.access, { ...cookieOptions('/'), maxAge: accessLifetime });
  response.cookie(refreshCookie, session.refresh, { ...cookieOptions('/api/auth'), maxAge: refreshLifetime });
}

export function clearAuthCookies(response: Response) {
  response.clearCookie(accessCookie, cookieOptions('/'));
  response.clearCookie(refreshCookie, cookieOptions('/api/auth'));
}
