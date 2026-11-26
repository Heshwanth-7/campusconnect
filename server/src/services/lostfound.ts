import { z } from 'zod';
import type { LostFoundPost, Prisma, Role } from '../generated/prisma/client.ts';
import type { postFields, postQuery } from '../validators/lostfound.ts';
import { db } from '../utils/prisma.ts';
import { HttpError } from '../utils/http-error.ts';
import { candidateDays, dayMs, scorePair } from './matching.service.ts';
import { notifyUser } from './notify-user.ts';

type Tx = Prisma.TransactionClient;
type Fields = z.infer<typeof postFields>;
type Actor = { id: string; role: Role };
type Notice = { matchId: string; users: string[] };

async function write<T>(work: (tx: Tx, notices: Notice[]) => Promise<T>) {
  const notices: Notice[] = [];
  const result = await db().$transaction(async tx => {
    // Serialize item writes so simultaneous posts see each other and competing confirmations cannot both win.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(143117, 1)`;
    return work(tx, notices);
  }, { isolationLevel: 'ReadCommitted', timeout: 30000 });
  for (const { matchId, users } of notices) {
    for (const userId of users) notifyUser(userId, 'possible-match', { matchId });
  }
  return result;
}

function involving(ids: string[]) {
  return { OR: [{ lostPostId: { in: ids } }, { foundPostId: { in: ids } }] };
}

async function suggest(tx: Tx, post: LostFoundPost, notices: Notice[], edited = false) {
  if (post.status !== 'OPEN') return;
  const threshold = z.coerce.number().int().min(0).max(100).parse(process.env.MATCH_THRESHOLD ?? 60);
  const range = candidateDays * dayMs;
  const date = post.occurredAt.getTime();
  const candidates = await tx.lostFoundPost.findMany({ where: {
    type: post.type === 'LOST' ? 'FOUND' : 'LOST', status: 'OPEN', category: post.category,
    userId: { not: post.userId }, occurredAt: { gte: new Date(date - range), lte: new Date(date + range) },
  } });
  const eligible: string[] = [];
  for (const candidate of candidates) {
    const [lost, found] = post.type === 'LOST' ? [post, candidate] : [candidate, post];
    const { score } = scorePair(lost, found);
    if (score < threshold) continue;
    eligible.push(candidate.id);
    const pair = { lostPostId: lost.id, foundPostId: found.id };
    const inserted = await tx.match.createManyAndReturn({ data: { ...pair, score }, skipDuplicates: true, select: { id: true } });
    if (inserted.length) {
      notices.push({ matchId: inserted[0].id, users: [lost.userId, found.userId] });
    } else if (edited) {
      await tx.match.updateMany({ where: { ...pair, status: 'SUGGESTED' },
        data: { score, lostUserConfirmedAt: null, foundUserConfirmedAt: null } });
    }
  }
  if (edited) {
    const opposite = post.type === 'LOST' ? 'foundPostId' : 'lostPostId';
    await tx.match.deleteMany({ where: { ...involving([post.id]), status: 'SUGGESTED', [opposite]: { notIn: eligible } } });
  }
}

export function createPost(userId: string, data: Fields, imagePath: string | null) {
  return write(async (tx, notices) => {
    const post = await tx.lostFoundPost.create({ data: { ...data, userId, imagePath } });
    await suggest(tx, post, notices);
    return post;
  });
}

async function owned(tx: Tx, id: string, actor: Actor, allowAdmin: boolean) {
  const post = await tx.lostFoundPost.findUnique({ where: { id } });
  if (!post) throw new HttpError(404, 'Post not found.');
  if (post.userId !== actor.id && !(allowAdmin && actor.role === 'ADMIN')) throw new HttpError(403, 'Only the owner can do that.');
  return post;
}

export function editPost(id: string, actor: Actor, data: Partial<Fields>) {
  return write(async (tx, notices) => {
    const previous = await owned(tx, id, actor, true);
    const changed = Object.entries(data).some(([key, value]) => {
      const old = previous[key as keyof Fields];
      return old instanceof Date && value instanceof Date
        ? old.toISOString().slice(0, 10) !== value.toISOString().slice(0, 10)
        : old !== value;
    });
    if (!changed) return previous;
    const confirmed = await tx.match.findFirst({ where: { ...involving([id]), status: 'CONFIRMED' } });
    if (confirmed && data.type && data.type !== previous.type) throw new HttpError(409, 'Dismiss the confirmed match before switching sides.');
    const post = await tx.lostFoundPost.update({ where: { id }, data });
    if (confirmed) {
      const pair = await tx.match.findUniqueOrThrow({ where: { id: confirmed.id }, include: { lostPost: true, foundPost: true } });
      await tx.match.update({ where: { id: pair.id }, data: { score: scorePair(pair.lostPost, pair.foundPost).score } });
    }
    await suggest(tx, post, notices, true);
    return post;
  });
}

async function reopen(tx: Tx, ids: string[], notices: Notice[]) {
  const posts = await tx.lostFoundPost.updateManyAndReturn({ where: { id: { in: ids }, status: 'MATCHED' }, data: { status: 'OPEN' } });
  for (const post of posts) await suggest(tx, post, notices);
}

export function deletePost(id: string, actor: Actor) {
  return write(async (tx, notices) => {
    const post = await owned(tx, id, actor, true);
    const pair = await tx.match.findFirst({ where: { ...involving([id]), status: 'CONFIRMED' } });
    await tx.lostFoundPost.delete({ where: { id } });
    if (pair) await reopen(tx, [pair.lostPostId, pair.foundPostId], notices);
    return post.imagePath;
  });
}

export function resolvePost(id: string, actor: Actor) {
  return write(async tx => {
    await owned(tx, id, actor, false);
    await tx.match.deleteMany({ where: { ...involving([id]), status: 'SUGGESTED' } });
    return tx.lostFoundPost.update({ where: { id }, data: { status: 'RESOLVED' } });
  });
}

export async function listPosts(query: z.infer<typeof postQuery>, userId?: string) {
  const { q, page, pageSize, ...filters } = query;
  const search = { contains: q, mode: 'insensitive' } as const;
  const posts = await db().lostFoundPost.findMany({
    where: { ...filters, userId, ...(q && { OR: [{ title: search }, { description: search }, { location: search }] }) },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize + 1,
  });
  return { posts: posts.slice(0, pageSize), hasMore: posts.length > pageSize, page };
}

export async function myMatches(userId: string) {
  const withContact = { include: { user: { select: { name: true, email: true } } } };
  const matches = await db().match.findMany({
    where: { OR: [{ lostPost: { userId } }, { foundPost: { userId } }], status: { not: 'DISMISSED' } },
    include: { lostPost: withContact, foundPost: withContact }, orderBy: [{ score: 'desc' }, { id: 'asc' }],
  });
  return matches.map(({ lostPost: { user: lostContact, ...lostPost }, foundPost: { user: foundContact, ...foundPost }, ...match }) => {
    const isLost = lostPost.userId === userId;
    const confirmed = match.status === 'CONFIRMED' && match.lostUserConfirmedAt && match.foundUserConfirmedAt;
    return { ...match, lostPost, foundPost, breakdown: scorePair(lostPost, foundPost).breakdown,
      mySideConfirmed: Boolean(isLost ? match.lostUserConfirmedAt : match.foundUserConfirmedAt),
      ...(confirmed && { contact: isLost ? foundContact : lostContact }),
    };
  });
}

export function decide(id: string, userId: string, action: 'confirm' | 'dismiss') {
  return write(async (tx, notices) => {
    const pair = await tx.match.findUnique({ where: { id }, include: { lostPost: true, foundPost: true } });
    if (!pair) throw new HttpError(404, 'Match not found.');
    const lost = pair.lostPost.userId === userId;
    if (!lost && pair.foundPost.userId !== userId) throw new HttpError(403, 'Only the two students can respond.');
    const ids = [pair.lostPostId, pair.foundPostId];
    if (action === 'dismiss') {
      await tx.match.update({ where: { id }, data: { status: 'DISMISSED' } });
      if (pair.status === 'CONFIRMED') await reopen(tx, ids, notices);
      return;
    }
    if (pair.status === 'DISMISSED') throw new HttpError(409, 'This match was dismissed.');
    if (pair.status === 'CONFIRMED') return;
    if (pair.lostPost.status !== 'OPEN' || pair.foundPost.status !== 'OPEN') throw new HttpError(409, 'This item is closed.');
    const side = lost ? 'lostUserConfirmedAt' : 'foundUserConfirmedAt';
    const both = Boolean(lost ? pair.foundUserConfirmedAt : pair.lostUserConfirmedAt);
    await tx.match.update({ where: { id }, data: { [side]: pair[side] ?? new Date(), status: both ? 'CONFIRMED' : 'SUGGESTED' } });
    if (both) {
      await tx.lostFoundPost.updateMany({ where: { id: { in: ids } }, data: { status: 'MATCHED' } });
      await tx.match.deleteMany({ where: { ...involving(ids), status: 'SUGGESTED' } });
    }
  });
}
