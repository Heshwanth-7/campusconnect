import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { app } from '../app.ts';
import { makeAccessToken } from '../utils/auth-tokens.ts';
import { db } from '../utils/prisma.ts';

const origin = 'http://localhost:5173';
const prefix = `events-${randomUUID()}`;
const roles = ['STUDENT', 'ORGANIZER', 'ADMIN'] as const;
type Role = (typeof roles)[number];
const ids = new Map<Role, string>();

beforeAll(async () => {
  vi.stubEnv('CLIENT_URL', origin);
  vi.stubEnv('JWT_ACCESS_SECRET', 'test-only-access-secret-for-campusconnect');
  for (const role of roles) {
    const user = await db().user.create({
      data: {
        email: `${prefix}-${role.toLowerCase()}@college.example`,
        name: role,
        role,
        passwordHash: 'not-used-by-event-tests',
        emailVerifiedAt: new Date(),
      },
    });
    ids.set(role, user.id);
  }
});

afterAll(async () => {
  try {
    const id = { in: [...ids.values()] };
    await db().auditLog.deleteMany({ where: { actorId: id } });
    await db().event.deleteMany({ where: { organizerId: id } });
    await db().user.deleteMany({ where: { id } });
  } finally {
    await db().$disconnect();
    vi.unstubAllEnvs();
  }
});

function client(role: Role, method: 'get' | 'post' | 'patch' | 'delete', path = '') {
  const userId = ids.get(role)!;
  return request(app)[method](`/api/events${path}`)
    .set('Cookie', `access_token=${makeAccessToken(userId, new Date())}`)
    .set('Origin', origin);
}

function eventBody() {
  return {
    title: `${prefix} Robotics`,
    description: 'Build a robot together.',
    category: 'TECH',
    tags: ['robotics'],
    venue: 'Engineering Lab',
    clubName: 'Robotics Club',
    startsAt: new Date(Date.now() + 86_400_000).toISOString(),
    endsAt: new Date(Date.now() + 90_000_000).toISOString(),
    capacity: 30,
  };
}

describe('events', () => {
  test('requires sign-in and prevents students from creating events', async () => {
    await request(app).get('/api/events').expect(401);
    await client('STUDENT', 'post').send(eventBody()).expect(403);
  });

  test('creates organizer events as pending and admin events as approved', async () => {
    const organizer = await client('ORGANIZER', 'post').send(eventBody()).expect(201);
    expect(organizer.body.event).toMatchObject({ status: 'PENDING', seatsLeft: 30, organizerId: ids.get('ORGANIZER') });
    const admin = await client('ADMIN', 'post').send(eventBody()).expect(201);
    expect(admin.body.event.status).toBe('APPROVED');
    const mine = await client('ORGANIZER', 'get', '/mine').expect(200);
    expect(mine.body.events.map((event: { id: string }) => event.id)).toContain(organizer.body.event.id);
    expect(mine.body.events.map((event: { id: string }) => event.id)).not.toContain(admin.body.event.id);
  });

  test('hides another user’s pending event from the student list and detail', async () => {
    const title = `${prefix} Hidden`;
    const { body } = await client('ORGANIZER', 'post').send({ ...eventBody(), title }).expect(201);
    const list = await client('STUDENT', 'get').query({ q: title }).expect(200);
    expect(list.body.events).toEqual([]);
    await client('STUDENT', 'get', `/${body.event.id}`).expect(404);
    await client('ORGANIZER', 'get', `/${body.event.id}`).expect(200);
  });

  test('searches title, description and club name case-insensitively and combines the category filter', async () => {
    const keyword = randomUUID();
    const [titleMatch, descriptionMatch, clubMatch] = await Promise.all([
      client('ADMIN', 'post').send({ ...eventBody(), title: keyword.toUpperCase() }).expect(201),
      client('ADMIN', 'post').send({ ...eventBody(), description: keyword }).expect(201),
      client('ADMIN', 'post').send({ ...eventBody(), clubName: keyword, category: 'MUSIC', tags: ['music'] }).expect(201),
    ]);
    const all = await client('STUDENT', 'get').query({ q: keyword }).expect(200);
    expect(all.body.events.map((event: { id: string }) => event.id).sort()).toEqual([
      titleMatch.body.event.id, descriptionMatch.body.event.id, clubMatch.body.event.id,
    ].sort());
    const first = await client('STUDENT', 'get').query({ q: keyword, category: 'TECH', pageSize: 1 }).expect(200);
    const second = await client('STUDENT', 'get').query({ q: keyword, category: 'TECH', pageSize: 1, page: 2 }).expect(200);
    expect(first.body.hasMore).toBe(true);
    expect(second.body.hasMore).toBe(false);
    expect([first.body.events[0].id, second.body.events[0].id].sort()).toEqual([
      titleMatch.body.event.id, descriptionMatch.body.event.id,
    ].sort());
  });

  test('allows only the owner or an admin to edit and delete', async () => {
    const approved = await client('ADMIN', 'post').send(eventBody()).expect(201);
    const adminPath = `/${approved.body.event.id}`;
    await client('ORGANIZER', 'patch', adminPath).send({ title: 'Another organizer' }).expect(403);
    await client('STUDENT', 'delete', adminPath).expect(403);
    await client('ADMIN', 'patch', adminPath).send({ title: 'Admin update' }).expect(200);
    await client('ADMIN', 'delete', adminPath).expect(204);

    const pending = await client('ORGANIZER', 'post').send(eventBody()).expect(201);
    const ownerPath = `/${pending.body.event.id}`;
    await client('ORGANIZER', 'patch', ownerPath).send({ venue: 'New venue' }).expect(200);
    await client('ORGANIZER', 'delete', ownerPath).expect(204);

    const organizerEvent = await client('ORGANIZER', 'post').send(eventBody()).expect(201);
    const organizerPath = `/${organizerEvent.body.event.id}`;
    await client('ADMIN', 'patch', organizerPath).send({ title: 'Admin override' }).expect(200);
    await client('ADMIN', 'delete', organizerPath).expect(204);
  });

  test('returns an approved event to pending when the organizer changes a key field', async () => {
    const { body } = await client('ORGANIZER', 'post').send(eventBody()).expect(201);
    const id = body.event.id;
    await db().event.update({ where: { id }, data: { status: 'APPROVED' } });
    const unchanged = await client('ORGANIZER', 'patch', `/${id}`).send({ title: body.event.title }).expect(200);
    expect(unchanged.body.event.status).toBe('APPROVED');
    const changed = await client('ORGANIZER', 'patch', `/${id}`).send({ venue: 'New venue' }).expect(200);
    expect(changed.body.event.status).toBe('PENDING');
    await client('STUDENT', 'get', `/${id}`).expect(404);
  });

  test('rejects invalid tags at creation and on edit', async () => {
    await client('ORGANIZER', 'post').send({ ...eventBody(), tags: ['invalid'] }).expect(400);
    const { body } = await client('ORGANIZER', 'post').send(eventBody()).expect(201);
    await client('ORGANIZER', 'patch', `/${body.event.id}`).send({ tags: ['invalid'] }).expect(400);
  });

  test('applies UTC date filters and validates capacity and the final time range', async () => {
    const fields = { ...eventBody(), title: `${prefix} Date Filter` };
    await client('ADMIN', 'post').send({ ...fields, capacity: 0 }).expect(400);
    await client('ADMIN', 'post').send({ ...fields, endsAt: fields.startsAt }).expect(400);
    const { body } = await client('ADMIN', 'post').send(fields).expect(201);
    await client('ADMIN', 'patch', `/${body.event.id}`).send({ startsAt: fields.endsAt }).expect(400);
    const list = await client('STUDENT', 'get').query({ q: fields.title, from: fields.endsAt }).expect(200);
    expect(list.body.events).toEqual([]);
    const inclusive = await client('STUDENT', 'get').query({ q: fields.title, from: fields.startsAt, to: fields.startsAt }).expect(200);
    expect(inclusive.body.events).toHaveLength(1);
  });
});

const posterPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==', 'base64');

test('only the owner or admin can attach, replace and remove the event poster', async () => {
  const { body } = await client('ORGANIZER', 'post').send(eventBody()).expect(201);
  const path = '/' + body.event.id;
  const poster = path + '/poster';
  expect(body.event.posterImagePath).toBeNull();
  await db().event.update({ where: { id: body.event.id }, data: { status: 'APPROVED' } });
  await client('STUDENT', 'post', poster).attach('poster', posterPng, 'poster.png').expect(403);
  await client('STUDENT', 'delete', poster).expect(403);
  const owner = await client('ORGANIZER', 'post', poster).attach('poster', posterPng, 'original.txt').expect(200);
  const first = owner.body.posterImagePath;
  expect(first).toMatch(/^\/uploads\/[a-f0-9-]{36}\.png$/);
  const admin = await client('ADMIN', 'post', poster).attach('poster', posterPng, 'original.png').expect(200);
  expect(admin.body.posterImagePath).not.toBe(first);
  const view = (file: string) => request(app).get(file).set('Cookie', 'access_token=' + makeAccessToken(ids.get('ADMIN')!, new Date()));
  await view(first).expect(404);
  await view(admin.body.posterImagePath).expect(200).expect('X-Content-Type-Options', 'nosniff');
  expect((await client('ADMIN', 'get', path)).body.event.posterImagePath).toBe(admin.body.posterImagePath);
  await client('ADMIN', 'delete', poster).expect(204);
  expect((await client('ADMIN', 'get', path)).body.event.posterImagePath).toBeNull();
  await view(admin.body.posterImagePath).expect(404);
});

test('rejects text disguised as a JPEG event poster', async () => {
  const { body } = await client('ADMIN', 'post').send(eventBody()).expect(201);
  await client('ADMIN', 'post', '/' + body.event.id + '/poster')
    .attach('poster', Buffer.from('plain text'), { filename: 'poster.jpg', contentType: 'image/jpeg' }).expect(415);
});
