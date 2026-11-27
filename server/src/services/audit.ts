import type { Prisma } from '../generated/prisma/client.ts';

type Action = 'EVENT_APPROVED' | 'EVENT_REJECTED' | 'EVENT_DELETED' | 'POST_DELETED'
  | 'USER_ROLE_CHANGED' | 'USER_BLOCKED' | 'USER_UNBLOCKED';

export async function audit(tx: Prisma.TransactionClient, actorId: string, action: Action,
  targetType: 'Event' | 'LostFoundPost' | 'User', targetId: string, metadata: Prisma.InputJsonObject) {
  return tx.auditLog.create({ data: { actorId, action, targetType, targetId, metadata } });
}
