import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { app } from '../app.ts';
import { makeAccessToken } from '../utils/auth-tokens.ts';
import { db } from '../utils/prisma.ts';

const origin = 'http://localhost:5173';
const prefix = randomUUID();
const users: { id: string; email: string; name: string }[] = [];
beforeAll(async () => {
  vi.stubEnv('CLIENT_URL', origin);
  vi.stubEnv('JWT_ACCESS_SECRET', 'test-only-access-secret-for-campusconnect');
  vi.stubEnv('MATCH_THRESHOLD', '60');
  for (const name of ['Owner', 'Finder', 'Third']) {
    users.push(await db().user.create({ data: {
      name, email: prefix + name.toLowerCase() + '@college.example', passwordHash: 'unused', emailVerifiedAt: new Date(),
      role: name === 'Third' ? 'ADMIN' : 'STUDENT',
    } }));
  }
});
afterAll(async () => {
  await db().user.deleteMany({ where: { id: { in: users.map(user => user.id) } } });
  await db().$disconnect();
  vi.unstubAllEnvs();
});
function api(index: number, method: 'post' | 'get' | 'patch' | 'delete', path: string) {
  return request(app)[method](path).set('Origin', origin)
    .set('Cookie', 'access_token=' + makeAccessToken(users[index].id, new Date()));
}
function report(index: number, type: string, category: string) {
  return api(index, 'post', '/api/lostfound').field({
    type, category, title: 'Blue bottle', description: 'Steel lid', color: 'blue', location: 'Lab 2', occurredAt: '2026-11-20',
  });
}
const mine = (i: number) => api(i, 'get', '/api/matches/mine').expect(200);
describe('lost and found', () => {
  test('simultaneous reports stay open until both users confirm, then share only the other contact', async () => {
    const [lost, found] = await Promise.all([report(0, 'LOST', 'BOTTLE').expect(201), report(1, 'FOUND', 'BOTTLE').expect(201)]);
    const pairs = (await mine(0)).body.matches;
    expect(pairs).toHaveLength(1);
    const [pair] = pairs;
    expect(pair).toMatchObject({ status: 'SUGGESTED', lostPost: { id: lost.body.post.id, status: 'OPEN' }, foundPost: { id: found.body.post.id, status: 'OPEN' } });
    expect(pair.contact).toBeUndefined();
    const path = '/api/matches/' + pair.id;
    await api(2, 'post', path + '/confirm').expect(403);
    await api(2, 'post', path + '/dismiss').expect(403);
    await api(0, 'post', path + '/confirm').expect(204);
    await api(0, 'post', path + '/confirm').expect(204);
    for (const i of [0, 1]) {
      const res = await mine(i);
      expect(res.text).not.toContain(users[1 - i].email);
      expect(res.text).not.toContain(users[1 - i].name);
      expect(res.body.matches[0]).toMatchObject({ status: 'SUGGESTED', foundUserConfirmedAt: null, mySideConfirmed: i === 0 });
    }
    await api(1, 'post', path + '/confirm').expect(204);
    for (const i of [0, 1]) {
      const other = users[1 - i];
      expect((await mine(i)).body.matches[0]).toMatchObject({ status: 'CONFIRMED',
        lostPost: { status: 'MATCHED' }, foundPost: { status: 'MATCHED' }, contact: { name: other.name, email: other.email } });
    }
  });
  test('own posts never pair and dismissal survives edits and new candidates', async () => {
    const lost = (await report(0, 'LOST', 'BAG').expect(201)).body.post;
    await report(0, 'FOUND', 'BAG').expect(201);
    expect(await db().match.count({ where: { lostPostId: lost.id } })).toBe(0);
    const found = (await report(1, 'FOUND', 'BAG').expect(201)).body.post;
    const pair = await db().match.findFirstOrThrow({ where: { lostPostId: lost.id } });
    await api(1, 'post', '/api/matches/' + pair.id + '/dismiss').expect(204);
    await api(0, 'patch', '/api/lostfound/' + lost.id).send({ title: 'Blue bottle again' }).expect(200);
    await report(2, 'FOUND', 'BAG').expect(201);
    expect(await db().match.count({ where: { lostPostId: lost.id, status: 'SUGGESTED' } })).toBe(1);
    expect(await db().match.findUnique({ where: { id: pair.id } })).toMatchObject({ status: 'DISMISSED', foundPostId: found.id });
  });
  test('a competing suggestion cannot claim a post that two students already confirmed', async () => {
    const lost = (await report(0, 'LOST', 'KEYS').expect(201)).body.post;
    await report(1, 'FOUND', 'KEYS').expect(201);
    await report(2, 'FOUND', 'KEYS').expect(201);
    const pairs = await db().match.findMany({ where: { lostPostId: lost.id }, include: { foundPost: true } });
    expect(pairs).toHaveLength(2);
    for (const pair of pairs) {
      const finder = users.findIndex(user => user.id === pair.foundPost.userId);
      await api(finder, 'post', '/api/matches/' + pair.id + '/confirm').expect(204);
    }
    const replies = await Promise.all(pairs.map(pair => api(0, 'post', '/api/matches/' + pair.id + '/confirm')));
    expect(replies.map(reply => reply.status).sort()).toEqual([204, 404]);
    expect(await db().match.count({ where: { lostPostId: lost.id, status: 'CONFIRMED' } })).toBe(1);
    expect(await db().lostFoundPost.count({ where: { id: { in: pairs.map(pair => pair.foundPostId) }, status: 'OPEN' } })).toBe(1);
  });
  test('rejects fake JPEGs and oversized photos, serves signature-verified PNGs under random names', async () => {
    await report(0, 'LOST', 'BOOK').attach('photo', Buffer.from('a plain text file'), { filename: 'item.jpg', contentType: 'image/jpeg' }).expect(415);
    await report(0, 'LOST', 'BOOK').attach('photo', Buffer.alloc(5 * 1024 * 1024 + 1), 'big.jpg').expect(413);
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==', 'base64');
    const { body } = await report(0, 'LOST', 'BOOK').attach('photo', png, { filename: 'original.txt', contentType: 'text/plain' }).expect(201);
    expect(body.post.imagePath).toMatch(/^\/uploads\/[a-f0-9-]{36}\.png$/);
    await api(1, 'get', body.post.imagePath).expect('Content-Type', /image\/png/).expect('X-Content-Type-Options', 'nosniff').expect(200);
    const path = '/api/lostfound/' + body.post.id;
    await api(1, 'patch', path).send({ title: 'Changed' }).expect(403);
    await api(1, 'delete', path).expect(403);
    await api(2, 'post', path + '/resolve').expect(403);
    await api(0, 'post', path + '/resolve').expect(200);
    const result = await api(0, 'get', '/api/lostfound/mine').query({ type: 'LOST', category: 'BOOK', status: 'RESOLVED', q: 'steel', pageSize: 1 }).expect(200);
    expect(result.body.posts[0].id).toBe(body.post.id);
    await api(2, 'delete', path).expect(204);
    await api(1, 'get', body.post.imagePath).expect(404);
  });
});
