import { createHash, randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import type { Response } from 'supertest';
import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { app } from '../app.ts';
import { db } from '../utils/prisma.ts';
import { sendAuthEmail } from '../services/auth-mail.ts';

vi.mock('../services/auth-mail.ts', () => ({ sendAuthEmail: vi.fn(async () => {}) }));

const origin = 'http://localhost:5173';
const prefix = `auth-${randomUUID()}-`;
const password = 'campus123';
const authPath = '/api/auth';

beforeEach(() => {
  vi.stubEnv('CLIENT_URL', origin);
  vi.stubEnv('ALLOWED_EMAIL_DOMAINS', 'college.example, students.college.example');
  vi.stubEnv('JWT_ACCESS_SECRET', 'test-only-access-secret-for-campusconnect');
  vi.mocked(sendAuthEmail).mockClear();
});

afterAll(async () => {
  try {
    await db().user.deleteMany({ where: { email: { startsWith: prefix } } });
  } finally {
    await db().$disconnect();
    vi.unstubAllEnvs();
  }
});

function emailAddress(domain = 'college.example') {
  return `${prefix}${randomUUID()}@${domain}`;
}

function post(path: string, body?: object) {
  const call = request(app).post(authPath + path).set('Origin', origin);
  return body ? call.send(body) : call;
}

function mailedToken(email: string, purpose: 'verify-email' | 'reset-password') {
  const delivery = vi.mocked(sendAuthEmail).mock.calls.findLast(
    ([recipient, action]) => recipient === email && action === purpose,
  );
  if (!delivery) throw new Error('Expected an auth email.');
  return delivery[2];
}

function cookie(response: Response, name: string) {
  const cookies: string[] = response.get('Set-Cookie') ?? [];
  const found = cookies.find((value) => value.startsWith(`${name}=`));
  if (!found) throw new Error(`Expected the ${name} cookie.`);
  return found.split(';')[0];
}

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

async function register(email = emailAddress()) {
  await post('/register', { name: 'Campus Student', email, password }).expect(201);
  return { email: email.toLowerCase(), verification: mailedToken(email.toLowerCase(), 'verify-email') };
}

async function verifiedUser() {
  const { email, verification } = await register();
  await post('/verify-email', { token: verification }).expect(200);
  return email;
}

function login(email: string, attempt = password) {
  return post('/login', { email, password: attempt });
}

function refresh(refreshCookie: string) {
  return post('/refresh').set('Cookie', refreshCookie);
}

describe('authentication', () => {
  test('rejects an email outside the allowed domains', async () => {
    await post('/register', {
      name: 'Campus Student', email: emailAddress('fakecollege.example'), password,
    }).expect(400, { error: { status: 400, message: 'Email domain is not allowed.' } });
  });

  test('rejects a weak password', async () => {
    await post('/register', { name: 'Campus Student', email: emailAddress(), password: 'onlyletters' })
      .expect(400);
  });

  test('accepts any email domain when the list is empty and stores email lowercase', async () => {
    vi.stubEnv('ALLOWED_EMAIL_DOMAINS', '');
    const email = emailAddress('elsewhere.example');
    await register(email.toUpperCase());
    expect(await db().user.count({ where: { email } })).toBe(1);
  });

  test('requires verification and consumes the verification link only once', async () => {
    const { email, verification } = await register();
    await login(email).expect(403, { error: { status: 403, message: 'Verify your email before logging in.' } });
    await request(app).get(`${authPath}/verify-email`).expect(404);
    await post('/verify-email', { token: verification }).expect(200);
    await post('/verify-email', { token: verification }).expect(400);
    await login(email).expect(204);
  });

  test('locks the account for 15 minutes after five failures and resets the counter on success', async () => {
    const email = await verifiedUser();
    const failure = { error: { status: 401, message: 'Invalid email or password' } };
    await login(emailAddress(), 'incorrect').expect(401, failure);
    const start = Date.now();
    for (let attempt = 0; attempt < 5; attempt++) {
      await login(email, 'incorrect').expect(401, failure);
    }
    const locked = await db().user.findUniqueOrThrow({ where: { email } });
    expect(locked.failedLoginCount).toBe(5);
    expect(locked.lockedUntil!.getTime()).toBeGreaterThanOrEqual(start + 15 * 60_000);
    expect(locked.lockedUntil!.getTime()).toBeLessThanOrEqual(Date.now() + 15 * 60_000);
    await login(email).expect(401, failure);

    await db().user.update({ where: { email }, data: { lockedUntil: new Date(Date.now() - 1) } });
    await login(email).expect(204);
    const unlocked = await db().user.findUniqueOrThrow({ where: { email } });
    expect(unlocked.failedLoginCount).toBe(0);
    expect(unlocked.lockedUntil).toBeNull();
  });

  test('sets scoped cookies and rotates the refresh token', async () => {
    const email = await verifiedUser();
    const signedIn = await login(email).expect(204);
    const [accessHeader, refreshHeader] = signedIn.get('Set-Cookie') ?? [];
    expect(/Max-Age=900; Path=\/;.+HttpOnly; SameSite=Lax/.test(accessHeader)).toBe(true);
    expect(/Max-Age=604800; Path=\/api\/auth;.+HttpOnly; SameSite=Lax/.test(refreshHeader)).toBe(true);
    const oldCookie = cookie(signedIn, 'refresh_token');
    const rotated = await refresh(oldCookie).expect(204);
    const old = await db().refreshToken.findUniqueOrThrow({
      where: { tokenHash: hash(oldCookie.split('=')[1]) }, include: { replacedBy: true },
    });
    expect(old.revokedAt).toBeInstanceOf(Date);
    expect(old.replacedBy?.tokenHash === hash(cookie(rotated, 'refresh_token').split('=')[1])).toBe(true);
    await request(app).get(`${authPath}/me`).set('Cookie', cookie(rotated, 'access_token')).expect(200);
  });

  test('reusing the same refresh cookie revokes every session, even during rotation', async () => {
    const email = await verifiedUser();
    const first = cookie(await login(email).expect(204), 'refresh_token');
    const second = cookie(await login(email).expect(204), 'refresh_token');

    const results = await Promise.all([refresh(first), refresh(first)]);
    expect(results.map((response) => response.status).sort()).toEqual([204, 401]);
    const rotated = results.find((response) => response.status === 204)!;
    await refresh(cookie(rotated, 'refresh_token')).expect(401);
    await refresh(second).expect(401);
    expect(await db().refreshToken.count({ where: { user: { email }, revokedAt: null } })).toBe(0);
  });

  test('refuses blocked users and reads the current role on authenticated requests', async () => {
    const email = await verifiedUser();
    const session = await login(email).expect(204);
    const access = cookie(session, 'access_token');
    const me = () => request(app).get(`${authPath}/me`).set('Cookie', access);
    expect((await me().expect(200)).body.user.role).toBe('STUDENT');
    await db().user.update({ where: { email }, data: { role: 'ORGANIZER' } });
    const { body } = await me().expect(200);
    expect(body.user.role).toBe('ORGANIZER');
    expect('passwordHash' in body.user).toBe(false);

    await db().user.update({ where: { email }, data: { blockedAt: new Date() } });
    await login(email).expect(401, { error: { status: 401, message: 'Invalid email or password' } });
    await me().expect(403);
    await refresh(cookie(session, 'refresh_token')).expect(401);
  });

  test('rejects foreign or missing origins and accepts a same-origin Referer as fallback', async () => {
    const email = emailAddress();
    await request(app).post(`${authPath}/forgot-password`)
      .set('Origin', 'https://foreign.example')
      .set('Referer', origin + '/sign-in')
      .send({ email }).expect(403);
    await request(app).post(`${authPath}/forgot-password`).send({ email }).expect(403);
    await request(app).post(`${authPath}/forgot-password`)
      .set('Referer', origin + '/sign-in')
      .send({ email }).expect(200);
  });

  test('uses the same resend and forgot responses for known and unknown addresses', async () => {
    const { email } = await register();
    for (const path of ['/resend-verification', '/forgot-password']) {
      const known = await post(path, { email }).expect(200);
      const unknown = await post(path, { email: emailAddress() }).expect(200);
      expect(known.body).toEqual(unknown.body);
    }
  });

  test('stores hashes for all three token types, consumes reset tokens, and revokes refresh sessions', async () => {
    const { email, verification } = await register();
    const user = await db().user.findUniqueOrThrow({
      where: { email }, include: { emailVerificationTokens: true },
    });
    expect(user.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(user.emailVerificationTokens[0].tokenHash === hash(verification)).toBe(true);
    expect(JSON.stringify(user.emailVerificationTokens).includes(verification)).toBe(false);

    await post('/verify-email', { token: verification }).expect(200);
    const signedIn = await login(email).expect(204);
    const refreshCookie = cookie(signedIn, 'refresh_token');
    const rawRefresh = refreshCookie.split('=')[1];
    const active = await db().refreshToken.findFirstOrThrow({ where: { userId: user.id } });
    expect(active.tokenHash === hash(rawRefresh)).toBe(true);
    expect(JSON.stringify(active).includes(rawRefresh)).toBe(false);

    await post('/forgot-password', { email }).expect(200);
    const reset = mailedToken(email, 'reset-password');
    const stored = await db().passwordResetToken.findFirstOrThrow({ where: { userId: user.id } });
    expect(stored.tokenHash === hash(reset)).toBe(true);
    expect(JSON.stringify(stored).includes(reset)).toBe(false);

    const resetResult = await post('/reset-password', { token: reset, password: 'newcampus456' }).expect(200);
    await post('/reset-password', { token: reset, password: 'ignored789' }).expect(200, resetResult.body);
    await post('/reset-password', {
      token: randomBytes(32).toString('base64url'), password: 'ignored789',
    }).expect(200, resetResult.body);
    await refresh(refreshCookie).expect(401);
    await login(email).expect(401);
    await login(email, 'newcampus456').expect(204);
  });

  test('logs out, revokes its refresh cookie, and clears both cookies', async () => {
    const email = await verifiedUser();
    const signedIn = await login(email).expect(204);
    const refreshCookie = cookie(signedIn, 'refresh_token');
    const loggedOut = await post('/logout').set('Cookie', refreshCookie).expect(204);
    expect(cookie(loggedOut, 'access_token')).toBe('access_token=');
    expect(cookie(loggedOut, 'refresh_token')).toBe('refresh_token=');
    await refresh(refreshCookie).expect(401);
  });
});
