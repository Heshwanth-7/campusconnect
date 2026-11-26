import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

const payload = z.strictObject({
  registrationId: z.uuid(), eventId: z.uuid(), nonce: z.uuid(), expiresAt: z.int().positive(),
});

export function qrSecret() {
  const secret = process.env.QR_SECRET;
  if (!secret || [...secret].length < 32) throw new Error('QR_SECRET must contain at least 32 characters.');
  return secret;
}

function signature(encoded: string) {
  return createHmac('sha256', qrSecret()).update(encoded).digest('base64url');
}

export function signTicket(claims: z.infer<typeof payload>) {
  const encoded = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return encoded + '.' + signature(encoded);
}

export function verifyTicket(token: string) {
  const parts = /^([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!parts || parts[0] !== token) return;
  const [, encoded, supplied] = parts;
  if (!timingSafeEqual(Buffer.from(signature(encoded)), Buffer.from(supplied))) return;
  try {
    return payload.parse(JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')));
  } catch {
    return;
  }
}
