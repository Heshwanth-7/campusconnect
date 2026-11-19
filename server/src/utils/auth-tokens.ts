import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

export const minute = 60_000;
export const day = 24 * 60 * minute;
export const accessLifetime = 15 * minute;
export const refreshLifetime = 7 * day;

export const opaqueToken = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function makeToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: tokenHash(token) };
}

const jwtHeader = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
const claims = z.object({
  sub: z.uuid(),
  exp: z.number().int(),
});

function sign(data: string) {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error('JWT_ACCESS_SECRET must contain at least 32 bytes.');
  }
  return createHmac('sha256', secret).update(data).digest();
}

export function makeAccessToken(userId: string, now: Date) {
  const payload = Buffer.from(JSON.stringify({
    sub: userId,
    exp: Math.floor((now.getTime() + accessLifetime) / 1000),
  })).toString('base64url');
  const data = `${jwtHeader}.${payload}`;
  return `${data}.${sign(data).toString('base64url')}`;
}

export function accessTokenUserId(token: string) {
  const [header, payload, signature, extra] = token.split('.');
  if (extra !== undefined || header !== jwtHeader || !payload || !signature) return;

  const expected = sign(`${header}.${payload}`);
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return;
  try {
    const parsed = claims.safeParse(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')));
    if (parsed.success && parsed.data.exp > Math.floor(Date.now() / 1000)) return parsed.data.sub;
  } catch {
    return;
  }
}
