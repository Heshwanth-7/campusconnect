import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/require-auth.ts';
import * as items from '../services/lostfound.ts';
import { imageUpload, removePhoto, savePhoto } from '../services/item-photo.ts';
import { postFields, postPatch, postQuery } from '../validators/lostfound.ts';

export const postsRouter = Router();
export const matchesRouter = Router();
// Auth: every post and match endpoint requires a verified, signed-in user.
postsRouter.use(requireAuth);
matchesRouter.use(requireAuth);

postsRouter.post('/', imageUpload('photo'), async (req, res) => {
  const data = postFields.parse(req.body);
  const imagePath = await savePhoto(req);
  const post = await items.createPost(res.locals.user.id, data, imagePath).catch(async error => {
    await removePhoto(imagePath);
    throw error;
  });
  res.status(201).json({ post });
});
postsRouter.get('/', async (req, res) => {
  res.json(await items.listPosts(postQuery.parse(req.query)));
});
postsRouter.get('/mine', async (req, res) => {
  res.json(await items.listPosts(postQuery.parse(req.query), res.locals.user.id));
});
// Auth: owner or admin for edits and deletion.
postsRouter.patch('/:id', async (req, res) => {
  res.json({ post: await items.editPost(z.uuid().parse(req.params.id), res.locals.user, postPatch.parse(req.body)) });
});
postsRouter.delete('/:id', async (req, res) => {
  await removePhoto(await items.deletePost(z.uuid().parse(req.params.id), res.locals.user));
  res.sendStatus(204);
});
// Auth: owner only.
postsRouter.post('/:id/resolve', async (req, res) => {
  res.json({ post: await items.resolvePost(z.uuid().parse(req.params.id), res.locals.user) });
});
// Auth: only the students involved can read or act on their matches.
matchesRouter.get('/mine', async (_req, res) => {
  res.set('Cache-Control', 'private, no-store').json({ matches: await items.myMatches(res.locals.user.id) });
});
for (const action of ['confirm', 'dismiss'] as const) {
  matchesRouter.post('/:id/' + action, async (req, res) => {
    await items.decide(z.uuid().parse(req.params.id), res.locals.user.id, action);
    res.sendStatus(204);
  });
}
