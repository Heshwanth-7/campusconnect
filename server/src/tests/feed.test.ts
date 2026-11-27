import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { app } from '../app.ts';
import { scoreEvent } from '../services/feed.service.ts';
import { makeAccessToken } from '../utils/auth-tokens.ts';
import { db } from '../utils/prisma.ts';

const now = new Date('2120-01-01T12:00:00Z');
const inDays = (days: number) => new Date(now.getTime() + days * 86_400_000);
const base = { tags: [], category: 'TECH' as const, startsAt: inDays(3), seatsLeft: 1 };
const student = { interests: ['robotics', 'coding'] };

test('matching tags stack and the category bonus applies once', () => {
  const match = scoreEvent({ ...base, tags: ['robotics', 'coding'] }, student, { now });
  const unrelated = scoreEvent({ ...base, category: 'MUSIC' }, student, { now });
  expect(match.score - unrelated.score).toBe(25);
  expect(match.reasons).toContain('Matches your interest: robotics');
});

test.each([[0, 8], [6, 8], [7, 8], [18.5, 4], [30, 0], [40, 0]])(
  'at %s days the time bonus is %s', (days, bonus) => {
    expect(scoreEvent({ ...base, startsAt: inDays(days) }, { interests: [] }, { now }).score).toBe(bonus);
  },
);

describe('personalised feed API', () => {
  const id = randomUUID();
  const other = randomUUID();
  const origin = 'http://localhost:5173';
  const auth = () => ({ Origin: origin, Cookie: `access_token=${makeAccessToken(id, now)}` });

  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
    vi.stubEnv('CLIENT_URL', origin);
    vi.stubEnv('JWT_ACCESS_SECRET', randomUUID());
    await db().user.createMany({ data: [id, other].map(userId => ({
      id: userId, email: `${userId}@college.example`, name: 'Feed test', passwordHash: 'unused', emailVerifiedAt: now,
    })) });
  });

  afterAll(async () => {
    try {
      await db().event.deleteMany({ where: { organizerId: other } });
      await db().user.deleteMany({ where: { id: { in: [id, other] } } });
    } finally {
      vi.useRealTimers();
      vi.unstubAllEnvs();
      await db().$disconnect();
    }
  });

  test('requires authentication and validates preferences', async () => {
    await request(app).get('/api/feed').expect(401);
    await request(app).patch('/api/users/me/interests').set('Origin', origin).send({ interests: [] }).expect(401);
    await request(app).patch('/api/users/me/interests').set(auth()).send({ interests: ['unknown'] }).expect(400);
    const me = await request(app).get('/api/auth/me').set(auth()).expect(200);
    expect(me.body.user).toMatchObject({ interests: [], interestsOnboarded: false });
  });

  test('filters eligibility, keeps full events, breaks ties and limits after ranking', async () => {
    const fixture = { organizerId: other, category: 'MUSIC' as const, capacity: 1, description: 'Test',
      venue: 'Hall', clubName: 'Club', status: 'APPROVED' as const, tags: [], startsAt: inDays(2), endsAt: inDays(3) };
    const create = (title: string, days: number, tags: string[] = []) => db().event.create({
      data: { ...fixture, title, tags, startsAt: inDays(days), endsAt: inDays(days + 1) },
    });
    const early = await create('Early', 1);
    const full = await create('Full', 4, ['robotics']);
    for (const status of ['CONFIRMED', 'WAITLISTED', 'CANCELLED'] as const) {
      const event = await create(status, 2, ['robotics']);
      await db().registration.create({ data: { userId: id, eventId: event.id, status } });
    }
    await db().registration.create({ data: { userId: other, eventId: full.id, status: 'CONFIRMED' } });
    await create('Past', -1, ['robotics']);
    await db().event.createMany({ data: (['PENDING', 'REJECTED'] as const).map(status => ({
      ...fixture, title: status, status, tags: ['robotics'],
    })) });
    const ties = Array.from({ length: 22 }, () => randomUUID()).sort();
    await db().event.createMany({ data: [...ties].reverse().map(id => ({ ...fixture, id, title: 'Tie' })) });

    const patch = (interests: string[]) => request(app).patch('/api/users/me/interests').set(auth()).send({ interests }).expect(200);
    await patch(['robotics']);
    const ranked = (await request(app).get('/api/feed').set(auth()).expect(200)).body.events;
    expect(ranked).toHaveLength(20);
    expect(ranked[0]).toMatchObject({ title: 'CANCELLED', score: 18 });
    expect(ranked[1]).toMatchObject({ id: full.id, score: 14, reasons: expect.arrayContaining(['Full: join the waitlist']) });
    expect(ranked[2].id).toBe(early.id);
    expect(ranked.slice(3).map((event: { id: string }) => event.id)).toEqual(ties.slice(0, 17));

    const saved = await patch([]);
    expect(saved.body.user).toMatchObject({ interests: [], interestsOnboarded: true });
    const byDate = (await request(app).get('/api/feed').set(auth()).expect(200)).body.events;
    expect(byDate).toHaveLength(20);
    expect(byDate[0].id).toBe(early.id);
    expect(byDate.map((event: { id: string }) => event.id)).toEqual([early.id, ...[ranked[0].id, ...ties].sort().slice(0, 19)]);
  });
});
