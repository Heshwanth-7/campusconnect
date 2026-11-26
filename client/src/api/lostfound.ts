import { z } from 'zod';
import { apiRequest } from './client';

export const category = z.enum(['BOTTLE', 'BAG', 'ID_CARD', 'ELECTRONICS', 'BOOK', 'CLOTHING', 'KEYS', 'OTHER']);
export const postType = z.enum(['LOST', 'FOUND']);
export const itemFields = z.object({
  type: postType, category, title: z.string().trim().min(1).max(160), description: z.string().trim().min(1).max(3000),
  color: z.string().trim().min(1).max(160), location: z.string().trim().min(1).max(160), occurredAt: z.iso.date(),
});
const post = itemFields.extend({
  id: z.uuid(), occurredAt: z.iso.datetime(), imagePath: z.string().nullable(), status: z.enum(['OPEN', 'MATCHED', 'RESOLVED']),
});
export type Post = z.infer<typeof post>;
const match = z.object({
  id: z.uuid(), lostPost: post, foundPost: post, status: z.enum(['SUGGESTED', 'CONFIRMED']),
  score: z.number(), mySideConfirmed: z.boolean(), contact: z.object({ name: z.string(), email: z.email() }).optional(),
  breakdown: z.object({ category: z.number(), color: z.number(), location: z.number(), text: z.number(), date: z.number() }),
});
export type ItemMatch = z.infer<typeof match>;
export async function listItems(type: Post['type'], page: number) {
  return z.object({ posts: z.array(post), hasMore: z.boolean() }).parse(await apiRequest('/lostfound?type=' + type + '&page=' + page));
}
export async function listMatches() {
  return z.object({ matches: z.array(match) }).parse(await apiRequest('/matches/mine')).matches;
}
export function decide(id: string, action: 'confirm' | 'dismiss') {
  return apiRequest('/matches/' + id + '/' + action, { method: 'POST' });
}
export function reportItem(body: FormData) {
  return apiRequest('/lostfound', { method: 'POST', body });
}
