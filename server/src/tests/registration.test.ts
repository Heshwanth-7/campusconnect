import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { app } from '../app.ts';
import { makeAccessToken } from '../utils/auth-tokens.ts';
import { db } from '../utils/prisma.ts';

const origin = 'http://localhost:5173';
const prefix = `registration-${randomUUID()}`;
let organizerId: string;
let adminId: string;
let students: string[];

beforeAll(async () => {
  vi.stubEnv('CLIENT_URL', origin);
  vi.stubEnv('QR_SECRET', 'fixture-only-qr-secret-for-campusconnect');
  vi.stubEnv('JWT_ACCESS_SECRET', 'test-only-access-secret-for-campusconnect');
  vi.spyOn(console, 'log').mockImplementation(() => {});
  const people = await db().user.createManyAndReturn({
    data: Array.from({ length: 32 }, (_, index) => ({
      email: `${prefix}-${index}@college.example`,
      name: `Registration fixture ${index}`,
      role: index === 0 ? 'ORGANIZER' : index === 1 ? 'ADMIN' : 'STUDENT',
      emailVerifiedAt: new Date(),
      passwordHash: 'unused-registration-test-fixture',
    })),
    select: { id: true, role: true },
  });
  organizerId = people.find(({ role }) => role === 'ORGANIZER')!.id;
  adminId = people.find(({ role }) => role === 'ADMIN')!.id;
  students = people.filter(({ role }) => role === 'STUDENT').map(({ id }) => id);
});

afterAll(async () => {
  try {
    const users = { email: { startsWith: prefix } };
    await db().event.deleteMany({ where: { organizer: users } });
    await db().user.deleteMany({ where: users });
  } finally {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    await db().$disconnect();
  }
});

async function event(capacity: number) {
  return db().event.create({ data: {
    organizerId, capacity, status: 'APPROVED', title: prefix, description: 'Registration test',
    category: 'TECH', tags: ['coding'], venue: 'Lab', clubName: 'Test Club',
    startsAt: new Date(Date.now() + 86_400_000), endsAt: new Date(Date.now() + 90_000_000),
  } });
}

function api(userId: string, method: 'get' | 'post' | 'patch' | 'delete', path: string) {
  return request(app)[method](`/api${path}`)
    .set('Origin', origin)
    .set('Cookie', `access_token=${makeAccessToken(userId, new Date())}`);
}

const eventPath = (eventId: string) => `/events/${eventId}`;
const join = (user: string, eventId: string) => api(user, 'post', eventPath(eventId) + '/register');
const leave = (user: string, eventId: string) => api(user, 'delete', eventPath(eventId) + '/register');

test.each([
  { capacity: 1, users: 20 },
  { capacity: 5, users: 30 },
])('capacity $capacity with $users concurrent HTTP registrations never overbooks', async ({ capacity, users }) => {
  const { id } = await event(capacity);
  const responses = await Promise.all(students.slice(0, users).map((user) => join(user, id).expect(201)));
  const states = responses.map(({ body }) => body.registration.status);
  expect(states.filter((status) => status === 'CONFIRMED')).toHaveLength(capacity);
  expect(states.filter((status) => status === 'WAITLISTED')).toHaveLength(users - capacity);
  const positions = responses.flatMap(({ body }) => body.myWaitlistPosition ?? []).sort((a, b) => a - b);
  expect(positions).toEqual(Array.from({ length: users - capacity }, (_, index) => index + 1));
  expect(await db().registration.count({ where: { eventId: id, status: 'CONFIRMED' } })).toBe(capacity);
  expect(await db().registration.count({ where: { eventId: id, status: 'WAITLISTED' } })).toBe(users - capacity);
});

test('cancelling a confirmed registration promotes the first waiting user and shifts positions', async () => {
  const { id } = await event(1);
  const [confirmed, first, second] = students;
  await join(confirmed, id).expect(201);
  expect((await join(first, id).expect(201)).body.myWaitlistPosition).toBe(1);
  expect((await join(second, id).expect(201)).body.myWaitlistPosition).toBe(2);
  await leave(confirmed, id).expect(200);
  const details = await api(first, 'get', eventPath(id)).expect(200);
  expect(details.body.event).toMatchObject({ seatsLeft: 0, myRegistrationStatus: 'CONFIRMED', myWaitlistPosition: null });
  const mine = await api(second, 'get', '/registrations/mine').expect(200);
  expect(mine.body.registrations).toContainEqual(expect.objectContaining({
    eventId: id, status: 'WAITLISTED', waitlistPosition: 1,
  }));
});

test('rejects a duplicate active registration even when the two requests arrive together', async () => {
  const { id } = await event(2);
  const user = students[0];
  const responses = await Promise.all([join(user, id), join(user, id)]);
  expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
  expect(await db().registration.count({ where: { eventId: id, userId: user } })).toBe(1);
});

test('cancel and rejoin reuses the registration row and puts the user at the back', async () => {
  const { id } = await event(1);
  const [confirmed, first, second] = students;
  await join(confirmed, id).expect(201);
  const original = (await join(first, id).expect(201)).body.registration;
  await join(second, id).expect(201);
  await leave(first, id).expect(200);
  const rejoined = (await join(first, id).expect(201)).body;
  expect(rejoined.myWaitlistPosition).toBe(2);
  expect(rejoined.registration).toMatchObject({ id: original.id, cancelledAt: null, createdAt: original.createdAt });
  await leave(confirmed, id).expect(200);
  expect((await api(second, 'get', eventPath(id)).expect(200)).body.event.myRegistrationStatus).toBe('CONFIRMED');
});

test('raising capacity promotes users in order and lowering below confirmed is rejected', async () => {
  const { id } = await event(1);
  for (const user of students.slice(0, 4)) await join(user, id).expect(201);
  await api(organizerId, 'patch', eventPath(id)).send({ capacity: 3 }).expect(200);
  const roster = await api(organizerId, 'get', eventPath(id) + '/registrations').expect(200);
  expect(roster.body.counts).toEqual({ CONFIRMED: 3, WAITLISTED: 1, CANCELLED: 0 });
  expect(roster.body.registrations.map(({ userId, status }: { userId: string; status: string }) => [userId, status])).toEqual([
    ...students.slice(0, 3).map((user) => [user, 'CONFIRMED']), [students[3], 'WAITLISTED'],
  ]);
  await api(adminId, 'patch', eventPath(id)).send({ capacity: 2 }).expect(409);
  expect((await db().event.findUniqueOrThrow({ where: { id } })).capacity).toBe(3);
  await api(students[0], 'get', eventPath(id) + '/registrations').expect(403);
  await api(adminId, 'get', eventPath(id) + '/registrations').expect(200);
});

test('rejects registrations for unapproved and already-started events', async () => {
  const { id } = await event(1);
  await db().event.update({ where: { id }, data: { status: 'PENDING' } });
  await join(students[0], id).expect(409);
  await db().event.update({ where: { id }, data: { status: 'APPROVED', startsAt: new Date(Date.now() - 1_000) } });
  await join(students[0], id).expect(409);
});

const qr = (userId: string, id: string) => api(userId, 'get', `/registrations/${id}/qr`);
const scan = (eventId: string, token: string, userId = organizerId) =>
  api(userId, 'post', '/checkin').send({ eventId, token });
const attendance = (eventId: string, userId: string) => api(userId, 'get', `/events/${eventId}/attendance`);

async function confirmedTicket() {
  const { id } = await event(1);
  const registrationId: string = (await join(students[0], id).expect(201)).body.registration.id;
  const ticket = await qr(students[0], registrationId).expect('Cache-Control', 'no-store').expect(200);
  return { id, registrationId, token: ticket.body.token as string, studentName: ticket.body.studentName as string };
}

test('tampering with the payload or signature is rejected without using the ticket', async () => {
  const { id, token, studentName } = await confirmedTicket();
  const [encoded, signature] = token.split('.');
  const claims = JSON.parse(Buffer.from(encoded, 'base64url').toString());
  const changed = Buffer.from(JSON.stringify({ ...claims, expiresAt: claims.expiresAt + 1000 })).toString('base64url');
  const changedSignature = (signature[0] === 'A' ? 'B' : 'A') + signature.slice(1);
  for (const invalid of [changed + '.' + signature, encoded + '.' + changedSignature]) {
    expect((await scan(id, invalid).expect(200)).body.result).toBe('INVALID');
  }
  expect((await scan(id, token).expect(200)).body).toEqual({ result: 'SUCCESS', studentName });
  expect((await scan(id, token).expect(200)).body.result).toBe('ALREADY_USED');
});

test('a signed ticket expires exactly one hour after the event ends', async () => {
  const { id, registrationId } = await confirmedTicket();
  const endsAt = new Date(Date.now() - 3_600_000);
  await db().event.update({ where: { id }, data: { startsAt: new Date(+endsAt - 1000), endsAt } });
  const { token } = (await qr(students[0], registrationId).expect(200)).body;
  expect(JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString()).expiresAt).toBe(+endsAt + 3_600_000);
  expect((await scan(id, token).expect(200)).body.result).toBe('EXPIRED');
});

test('event binding, ticket ownership, and scanner and attendance permissions', async () => {
  const { id, registrationId, token } = await confirmedTicket();
  const other = await event(1);
  expect((await scan(other.id, token).expect(200)).body.result).toBe('WRONG_EVENT');
  await qr(students[1], registrationId).expect(404);
  await qr(adminId, registrationId).expect(404);
  await scan(id, token, students[0]).expect(403);
  await attendance(id, students[0]).expect(403);
  await db().event.update({ where: { id }, data: { organizerId: adminId } });
  await scan(id, token).expect(403);
  await attendance(id, organizerId).expect(403);
  expect((await scan(id, token, adminId).expect(200)).body.result).toBe('SUCCESS');
  await attendance(id, adminId).expect(200);
});

test('10 simultaneous scans record exactly one check-in and one attendee', async () => {
  const { id, registrationId, token, studentName } = await confirmedTicket();
  const waiting = (await join(students[1], id).expect(201)).body.registration.id;
  await qr(students[1], waiting).expect(409);
  expect((await attendance(id, organizerId)).body).toMatchObject({ registered: 1, checkedIn: 0 });
  const responses = await Promise.all(Array.from({ length: 10 }, () => scan(id, token).expect(200)));
  const outcomes = responses.map(r => r.body.result);
  expect(outcomes.filter(x => x === 'SUCCESS')).toHaveLength(1);
  expect(outcomes.filter(x => x === 'ALREADY_USED')).toHaveLength(9);
  expect((await attendance(id, organizerId).expect(200)).body).toMatchObject({
    registered: 1, checkedIn: 1, registrations: [{ id: registrationId, user: { name: studentName }, checkedInAt: expect.any(String) }],
  });
});

test('cancellation invalidates the QR and re-registration issues a new single-use ticket', async () => {
  const { id, registrationId, token } = await confirmedTicket();
  await leave(students[0], id).expect(200);
  await qr(students[0], registrationId).expect(409);
  expect((await scan(id, token).expect(200)).body.result).toBe('NOT_CONFIRMED');
  await join(students[0], id).expect(201);
  const fresh = (await qr(students[0], registrationId).expect(200)).body.token;
  expect((await scan(id, token).expect(200)).body.result).toBe('INVALID');
  expect((await scan(id, fresh).expect(200)).body.result).toBe('SUCCESS');
});

test('a returning student promoted from the waitlist receives a fresh ticket', async () => {
  const { id, registrationId, token } = await confirmedTicket();
  expect((await scan(id, token)).body.result).toBe('SUCCESS');
  await leave(students[0], id).expect(200);
  await join(students[1], id).expect(201);
  await join(students[0], id).expect(201);
  await leave(students[1], id).expect(200);
  const fresh = (await qr(students[0], registrationId).expect(200)).body.token;
  expect((await scan(id, token)).body.result).toBe('INVALID');
  expect((await scan(id, fresh)).body.result).toBe('SUCCESS');
});
