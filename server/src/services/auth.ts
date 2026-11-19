import { randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import type { Prisma, User } from '../generated/prisma/client.ts';
import { db } from '../utils/prisma.ts';
import { HttpError } from '../utils/http-error.ts';
import { day, makeAccessToken, makeToken, minute, refreshLifetime, tokenHash } from '../utils/auth-tokens.ts';
import { sendAuthEmail } from './auth-mail.ts';

const failureLimit = 5;
const lockDuration = 15 * minute;
const resetLifetime = 60 * minute;
const passwordOptions = { type: argon2.argon2id } as const;
let dummyHash: Promise<string> | undefined;

async function lockUser(tx: Prisma.TransactionClient, id: string) {
  // Every session mutation for a user takes this lock before touching token rows.
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${id}::uuid FOR UPDATE`;
  return tx.user.findUnique({ where: { id } });
}

function revokeSessions(tx: Prisma.TransactionClient, userId: string, now: Date) {
  return tx.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: now },
  });
}

async function createSession(tx: Prisma.TransactionClient, userId: string, now: Date) {
  const access = makeAccessToken(userId, now);
  const { token: refresh, tokenHash } = makeToken();
  const { id } = await tx.refreshToken.create({
    data: { userId, tokenHash, expiresAt: new Date(now.getTime() + refreshLifetime) },
    select: { id: true },
  });
  return { id, access, refresh };
}

export async function register(input: { name: string; email: string; password: string }) {
  const domains = (process.env.ALLOWED_EMAIL_DOMAINS ?? '').split(',')
    .map((domain) => domain.trim().toLowerCase().replace(/^@/, '')).filter(Boolean);
  const domain = input.email.slice(input.email.lastIndexOf('@') + 1);
  if (domains.length && !domains.includes(domain)) {
    throw new HttpError(400, 'Email domain is not allowed.');
  }

  const passwordHash = await argon2.hash(input.password, passwordOptions);
  const { token, tokenHash } = makeToken();
  try {
    await db().user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        emailVerificationTokens: {
          create: { tokenHash, expiresAt: new Date(Date.now() + day) },
        },
      },
      select: { id: true },
    });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      throw new HttpError(409, 'Email is already registered.');
    }
    throw error;
  }

  try {
    await sendAuthEmail(input.email, 'verify-email', token);
  } catch {
    throw new HttpError(503, 'Verification email could not be sent. Request a new verification email.');
  }
}

export async function verifyEmail(token: string) {
  const hash = tokenHash(token);
  const verified = await db().$transaction(async (tx) => {
    const candidate = await tx.emailVerificationToken.findUnique({ where: { tokenHash: hash } });
    if (!candidate) return false;
    const user = await lockUser(tx, candidate.userId);
    if (!user || user.emailVerifiedAt) return false;
    const now = new Date();
    const result = await tx.emailVerificationToken.deleteMany({
      where: { id: candidate.id, expiresAt: { gt: now } },
    });
    if (!result.count) return false;
    await tx.user.update({ where: { id: user.id }, data: { emailVerifiedAt: now } });
    await tx.emailVerificationToken.deleteMany({ where: { userId: user.id } });
    return true;
  });
  if (!verified) throw new HttpError(400, 'Invalid or expired verification token.');
}

export async function requestAuthEmail(email: string, purpose: 'verify-email' | 'reset-password') {
  const user = await db().user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return;
  const { token, tokenHash } = makeToken();
  const issued = await db().$transaction(async (tx) => {
    const current = await lockUser(tx, user.id);
    if (!current || current.blockedAt) return false;
    if (purpose === 'verify-email') {
      if (current.emailVerifiedAt) return false;
      await tx.emailVerificationToken.create({
        data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + day) },
      });
    } else {
      await tx.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + resetLifetime) },
      });
    }
    return true;
  });
  // Mail delivery must not change the public response for a known address.
  if (issued) void sendAuthEmail(email, purpose, token).catch(() => {});
}

export async function resetPassword(token: string, password: string) {
  const hash = tokenHash(token);
  const candidate = await db().passwordResetToken.findUnique({ where: { tokenHash: hash } });
  if (!candidate || candidate.expiresAt <= new Date()) return;
  const passwordHash = await argon2.hash(password, passwordOptions);
  await db().$transaction(async (tx) => {
    const user = await lockUser(tx, candidate.userId);
    if (!user || user.blockedAt) return;
    const now = new Date();
    const result = await tx.passwordResetToken.deleteMany({
      where: { id: candidate.id, expiresAt: { gt: now } },
    });
    if (!result.count) return;
    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
    });
    await tx.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await revokeSessions(tx, user.id, now);
  });
}

function invalidLogin() {
  return new HttpError(401, 'Invalid email or password');
}

async function checkPassword(tx: Prisma.TransactionClient, user: User, valid: boolean, now: Date) {
  if (user.lockedUntil && user.lockedUntil > now) return false;
  if (valid) return true;
  const failedLoginCount = (user.lockedUntil ? 0 : user.failedLoginCount) + 1;
  await tx.user.update({
    where: { id: user.id },
    data: {
      failedLoginCount,
      lockedUntil: failedLoginCount >= failureLimit ? new Date(now.getTime() + lockDuration) : null,
    },
  });
  return false;
}

export async function login(email: string, password: string) {
  dummyHash ??= argon2.hash(randomBytes(32), passwordOptions);
  const fallback = await dummyHash;
  const candidate = await db().user.findUnique({ where: { email } });
  const valid = await argon2.verify(candidate?.passwordHash ?? fallback, password);
  if (!candidate) throw invalidLogin();

  const result = await db().$transaction(async (tx) => {
    const user = await lockUser(tx, candidate.id);
    if (!user || user.passwordHash !== candidate.passwordHash || user.blockedAt) return null;
    const now = new Date();
    // Only someone who knows the password can learn whether the account is locked.
    if (valid && user.lockedUntil && user.lockedUntil > now) {
      throw new HttpError(423, 'Account is temporarily locked.', {
        code: 'ACCOUNT_LOCKED',
        lockedUntil: user.lockedUntil.toISOString(),
      });
    }
    if (!await checkPassword(tx, user, valid, now)) return null;
    if (!user.emailVerifiedAt) throw new HttpError(403, 'Verify your email before logging in.');
    await tx.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
    return createSession(tx, user.id, now);
  });
  if (!result) throw invalidLogin();
  return result;
}

export async function refreshSession(token: string) {
  const invalidRefresh = () => new HttpError(401, 'Invalid refresh token.');
  const candidate = await db().refreshToken.findUnique({ where: { tokenHash: tokenHash(token) } });
  if (!candidate) throw invalidRefresh();

  const rotated = await db().$transaction(async (tx) => {
    const user = await lockUser(tx, candidate.userId);
    if (!user) return null;
    const current = await tx.refreshToken.findUnique({ where: { id: candidate.id } });
    if (!current) return null;
    const now = new Date();
    if (current.revokedAt) {
      await revokeSessions(tx, user.id, now);
      return null;
    }
    if (current.expiresAt <= now || user.blockedAt || !user.emailVerifiedAt) return null;

    const next = await createSession(tx, user.id, now);
    await tx.refreshToken.update({
      where: { id: current.id },
      data: { revokedAt: now, replacedById: next.id },
    });
    return next;
  });
  if (!rotated) throw invalidRefresh();
  return rotated;
}

export async function logout(token: string) {
  const current = await db().refreshToken.findUnique({ where: { tokenHash: tokenHash(token) } });
  if (!current) return;
  await db().$transaction(async (tx) => {
    if (await lockUser(tx, current.userId)) {
      await tx.refreshToken.updateMany({
        where: { id: current.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  });
}
