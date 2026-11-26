import { z } from 'zod';
import { ItemCategory, PostStatus, PostType } from '../generated/prisma/enums.ts';

const label = z.string().trim().min(1).max(160);
export const postFields = z.strictObject({
  type: z.enum(PostType), category: z.enum(ItemCategory), title: label, description: z.string().trim().min(1).max(3000),
  color: label, location: label,
  occurredAt: z.union([z.iso.date(), z.iso.datetime({ offset: true })]).transform(value => new Date(value)),
});
export const postPatch = postFields.partial().refine(data => Object.keys(data).length > 0);
export const postQuery = z.strictObject({
  type: z.enum(PostType).optional(), category: z.enum(ItemCategory).optional(), status: z.enum(PostStatus).optional(),
  q: z.string().trim().max(160).optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});
