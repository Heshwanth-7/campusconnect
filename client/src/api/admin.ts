import { z } from 'zod';
import { userRole } from './auth';

export const stats = z.object({
  users: z.number(), events: z.object({ PENDING: z.number(), APPROVED: z.number(), REJECTED: z.number() }),
  registrations: z.number(), checkIns: z.number(), lostFound: z.object({ OPEN: z.number(), MATCHED: z.number() }),
});
function page<T extends z.ZodType>(row: T) {
  return z.object({ rows: z.array(row), hasMore: z.boolean() });
}
export const events = page(z.object({
  id: z.uuid(), title: z.string(), clubName: z.string(), venue: z.string(), startsAt: z.iso.datetime(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
}));
export const users = page(z.object({
  id: z.uuid(), name: z.string(), email: z.string(), role: userRole, blockedAt: z.iso.datetime().nullable(),
}));
export const actions = ['EVENT_APPROVED', 'EVENT_REJECTED', 'EVENT_DELETED', 'POST_DELETED',
  'USER_ROLE_CHANGED', 'USER_BLOCKED', 'USER_UNBLOCKED'] as const;
export const auditLog = page(z.object({
  id: z.uuid(), createdAt: z.iso.datetime(), action: z.string(), actorId: z.uuid(), actorName: z.string().nullable(), targetType: z.string(),
  targetId: z.uuid(), metadata: z.record(z.string(), z.unknown()),
}));
export const posts = z.object({ posts: z.array(z.object({
  id: z.uuid(), title: z.string(), type: z.string(), status: z.string(), location: z.string(),
})), hasMore: z.boolean() });
