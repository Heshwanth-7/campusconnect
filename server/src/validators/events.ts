import { z } from 'zod';
import { EVENT_CATEGORIES, INTERESTS } from '../utils/event-constants.ts';

const instant = z.iso.datetime({ offset: true }).transform((value) => new Date(value));
const category = z.enum(EVENT_CATEGORIES);
const fields = z.strictObject({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(3000),
  category,
  tags: z.array(z.enum(INTERESTS)).max(INTERESTS.length).refine((tags) => new Set(tags).size === tags.length),
  venue: z.string().trim().min(1).max(160),
  startsAt: instant,
  endsAt: instant,
  capacity: z.number().int().min(1).max(2_147_483_647),
  clubName: z.string().trim().min(1).max(160),
});

export const eventCreate = fields;
export const eventPatch = fields.partial().refine((body) => Object.keys(body).length > 0);
export const eventId = z.uuid();
const integerParam = (max: number) => z.string().regex(/^\d+$/).transform(Number)
  .pipe(z.number().int().min(1).max(max));

export const eventQuery = z.strictObject({
  q: z.string().trim().max(160).optional(),
  category: category.optional(),
  from: instant.optional(),
  to: instant.optional(),
  page: integerParam(100_000).optional().transform((value) => value ?? 1),
  pageSize: integerParam(50).optional().transform((value) => value ?? 12),
}).refine(({ from, to }) => !from || !to || from <= to);
