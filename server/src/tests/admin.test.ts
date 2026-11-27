import { protectAdminAccess } from '../services/admin.ts';
import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import request from 'supertest';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { app } from '../app.ts';
import * as auditService from '../services/audit.ts';
import { sendMail } from '../services/mail.ts';
import { makeAccessToken } from '../utils/auth-tokens.ts';
import { db } from '../utils/prisma.ts';

vi.mock('../services/mail.ts', () => ({ sendMail: vi.fn(async () => {}) }));

const origin = 'http://localhost:5173';
const admin = randomUUID(), student = randomUUID(), organizer = randomUUID(), otherAdmin = randomUUID();
const ids = [admin, student, organizer, otherAdmin];
const email = (id: string) => id + '@college.example';
const password = 'campus123!';
beforeAll(async () => {
  vi.stubEnv('CLIENT_URL', origin);
  vi.stubEnv('JWT_ACCESS_SECRET', 'test-only-access-secret-for-campusconnect');
  const passwordHash = await argon2.hash(password);
  await db().user.createMany({ data: ids.map(id => ({ id, name: id, email: email(id), passwordHash,
    emailVerifiedAt: new Date(), role: id === student ? 'STUDENT' : id === organizer ? 'ORGANIZER' : 'ADMIN' })) });
});
afterAll(async () => {
  await db().auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await db().event.deleteMany({ where: { organizerId: organizer } });
  await db().user.deleteMany({ where: { id: { in: ids } } });
  await db().$disconnect();
  vi.unstubAllEnvs();
});
type Method = 'get' | 'post' | 'patch' | 'delete';
function call(id: string, method: Method, path: string) {
  return request(app)[method]('/api/admin' + path).set('Origin', origin)
    .set('Cookie', 'access_token=' + makeAccessToken(id, new Date()));
}
function pending() {
  return db().event.create({ data: { organizerId: organizer, title: 'Robotics', description: 'Demo',
    category: 'TECH', tags: [], venue: 'Hall', startsAt: new Date(), endsAt: new Date(Date.now() + 60000),
    capacity: 10, clubName: 'Robotics Club' } });
}
test('every admin route rejects a signed-in non-admin before processing inputs', async () => {
  const routes: [Method, string][] = [
    ['get', '/stats'], ['get', '/events'], ['post', '/events/:id/approve'], ['post', '/events/:id/reject'],
    ['delete', '/events/:id'], ['delete', '/lostfound/:id'], ['get', '/users'], ['patch', '/users/:id/role'],
    ['post', '/users/:id/block'], ['post', '/users/:id/unblock'], ['get', '/audit-log'],
  ];
  for (const [method, path] of routes) await call(student, method, path.replace(':id', admin)).expect(403);
});
test('approval commits once, audits the actor and notifies the organizer', async () => {
  const event = await pending();
  const path = '/events/' + event.id + '/approve';
  const results = await Promise.all([call(admin, 'post', path), call(admin, 'post', path)]);
  expect(results.map(r => r.status).sort()).toEqual([200, 409]);
  expect(await db().event.findUniqueOrThrow({ where: { id: event.id } })).toMatchObject({ status: 'APPROVED' });
  const log = await call(admin, 'get', '/audit-log').query({ action: 'EVENT_APPROVED', actor: admin }).expect(200);
  expect(log.body.rows).toEqual([expect.objectContaining({ actorId: admin, targetId: event.id, action: 'EVENT_APPROVED' })]);
  expect(await db().notification.count({ where: { userId: organizer, type: 'EVENT_APPROVED', linkPath: '/events/' + event.id } })).toBe(1);
  expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: email(organizer) }));
});
test('reject requires a reason and includes it in the organizer notification', async () => {
  const event = await pending();
  const path = '/events/' + event.id + '/reject';
  await call(admin, 'post', path).send({ reason: '  ' }).expect(400);
  const result = await call(admin, 'post', path).send({ reason: ' Venue missing ' }).expect(200);
  expect(result.body.event).toMatchObject({ status: 'REJECTED', rejectionReason: 'Venue missing' });
  expect(await db().notification.findFirst({ where: { userId: organizer, type: 'EVENT_REJECTED', linkPath: '/events/' + event.id } }))
    .toMatchObject({ message: expect.stringContaining('Venue missing') });
});
test('an admin cannot block or demote themselves even with another active admin', async () => {
  await call(admin, 'post', '/users/' + admin + '/block').expect(409);
  await call(admin, 'patch', '/users/' + admin + '/role').send({ role: 'STUDENT' }).expect(409);
});
test('the last active administrator is protected independently of the self-change guard', () => {
  expect(() => protectAdminAccess(otherAdmin, admin, 0)).toThrow('last active administrator');
  expect(() => protectAdminAccess(admin, admin, 0)).toThrow('last active administrator');
  expect(() => protectAdminAccess(otherAdmin, admin, 1)).not.toThrow();
});
test('competing demotions preserve an active administrator and invalidate the losing session’s privileges', async () => {
  const demote = (actor: string, target: string) => call(actor, 'patch', '/users/' + target + '/role').send({ role: 'STUDENT' });
  const results = await Promise.all([demote(admin, otherAdmin), demote(otherAdmin, admin)]);
  expect(results.map(r => r.status).sort()).toEqual([204, 403]);
  const lost = results[0].status === 204 ? otherAdmin : admin;
  const remaining = lost === admin ? otherAdmin : admin;
  await call(lost, 'get', '/stats').expect(403);
  await call(remaining, 'patch', '/users/' + lost + '/role').send({ role: 'ADMIN' }).expect(204);
});
test('blocking revokes every refresh token, denies login and stops existing sessions', async () => {
  const login = () => request(app).post('/api/auth/login').set('Origin', origin).send({ email: email(student), password });
  await login().expect(204);
  const session = await login().expect(204);
  const cookies = session.get('Set-Cookie')!.map(c => c.split(';')[0]);
  await call(admin, 'post', '/users/' + student + '/block').expect(204);
  await login().expect(401);
  await request(app).get('/api/auth/me').set('Cookie', cookies).expect(403);
  expect(await db().refreshToken.count({ where: { userId: student, revokedAt: null } })).toBe(0);
  await call(admin, 'post', '/users/' + student + '/unblock').expect(204);
  await request(app).post('/api/auth/refresh').set('Origin', origin).set('Cookie', cookies).expect(401);
  await login().expect(204);
});
test('a failure after the audit insert rolls back the audit and leaves the event pending', async () => {
  const event = await pending();
  const insert = auditService.audit;
  let inserted = false;
  const fault = vi.spyOn(auditService, 'audit').mockImplementationOnce(async (...args) => {
    await insert(...args);
    inserted = true;
    throw new Error('Injected failure after insert');
  });
  try {
    await call(admin, 'post', '/events/' + event.id + '/approve').expect(500);
  } finally { fault.mockRestore(); }
  expect(inserted).toBe(true);
  expect(await db().auditLog.count({ where: { targetId: event.id } })).toBe(0);
  expect(await db().event.findUniqueOrThrow({ where: { id: event.id } })).toMatchObject({ status: 'PENDING' });
  expect(await db().notification.count({ where: { linkPath: '/events/' + event.id } })).toBe(0);
});
test('user search, stats and both spam removals are available to admins', async () => {
  const users = await call(admin, 'get', '/users').query({ search: email(student), pageSize: 1 }).expect(200);
  expect(users.body.rows).toEqual([{ id: student, name: student, email: email(student), role: 'STUDENT', blockedAt: null }]);
  const event = await pending();
  const post = await db().lostFoundPost.create({ data: { userId: student, type: 'FOUND', category: 'KEYS',
    title: 'Keys', description: 'Keys near hall', location: 'Hall', color: 'Silver', occurredAt: new Date() } });
  const stats = await call(admin, 'get', '/stats').expect(200);
  expect(stats.body.events.PENDING).toBeGreaterThanOrEqual(1);
  expect(stats.body.lostFound.OPEN).toBeGreaterThanOrEqual(1);
  await call(admin, 'delete', '/events/' + event.id).expect(204);
  await call(admin, 'delete', '/lostfound/' + post.id).expect(204);
  const logs = await db().auditLog.findMany({ where: { actorId: admin, targetId: { in: [event.id, post.id] } } });
  expect(logs.map(row => row.action).sort()).toEqual(['EVENT_DELETED', 'POST_DELETED']);
  expect(await db().event.findUnique({ where: { id: event.id } })).toBeNull();
  expect(await db().lostFoundPost.findUnique({ where: { id: post.id } })).toBeNull();
});
