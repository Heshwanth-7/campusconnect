import type { LostFoundPost } from '../generated/prisma/client.ts';

type Item = Pick<LostFoundPost, 'category' | 'title' | 'description' | 'location' | 'color' | 'occurredAt'>;

// Maximum points for each clue. Together they add up to 100.
export const weights = { category: 30, color: 15, text: 30, location: 15, date: 10 } as const;
export const dayMs = 86_400_000;
export const candidateDays = 30;
const stopWords = new Set('a an the and or is was my i in on at of to with lost found'.split(' '));
const synonyms = new Map([['grey', 'gray'], ['navy blue', 'navy'], ['aqua', 'cyan'], ['violet', 'purple']]);

function colorKey(value: string) {
  const key = value.trim().toLowerCase().replace(/\s+/g, ' ');
  return synonyms.get(key) ?? key;
}

function tokens(value: string) {
  return new Set((value.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter(word => !stopWords.has(word)));
}

function overlap(left: string, right: string) {
  const a = tokens(left);
  const b = tokens(right);
  const union = new Set([...a, ...b]).size;
  return union ? [...a].filter(word => b.has(word)).length / union : 0;
}

export function scorePair(lost: Item, found: Item) {
  const days = Math.floor(found.occurredAt.getTime() / dayMs) - Math.floor(lost.occurredAt.getTime() / dayMs);
  const breakdown = { category: 0, color: 0, text: 0, location: 0, date: 0 };
  if (lost.category !== found.category || Math.abs(days) > candidateDays) return { score: 0, breakdown };

  breakdown.category = weights.category;
  breakdown.color = colorKey(lost.color) === colorKey(found.color) ? weights.color : 0;
  breakdown.text = Math.round(weights.text * overlap(lost.title + ' ' + lost.description, found.title + ' ' + found.description));
  breakdown.location = Math.round(weights.location * overlap(lost.location, found.location));
  breakdown.date = days < -1 ? 0 : Math.round(weights.date * Math.max(0, 1 - Math.abs(days) / 7));
  return { score: Object.values(breakdown).reduce((sum, points) => sum + points, 0), breakdown };
}
