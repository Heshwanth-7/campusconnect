import { randomBytes } from 'node:crypto';
import { afterEach, expect, test, vi } from 'vitest';
import { sendAuthEmail } from '../services/auth-mail.ts';
import { sendMail } from '../services/mail.ts';

vi.mock('../services/mail.ts', () => ({ sendMail: vi.fn() }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

test.each(['verify-email', 'reset-password'] as const)('%s keeps the email secret out of the HTTP URL', async purpose => {
  const origin = 'https://campus.example';
  vi.stubEnv('CLIENT_URL', origin);
  const token = randomBytes(32).toString('base64url');
  await sendAuthEmail('student@college.example', purpose, token);
  const message = vi.mocked(sendMail).mock.calls[0][0];
  const link = new URL(message.text.split('\n')[1]);
  expect(new URLSearchParams(link.hash.slice(1)).get('token') === token).toBe(true);
  link.hash = '';
  expect(link.href).toBe(origin + '/' + purpose);
});
