import { z } from 'zod';
import { apiRequest } from './client';

const notification = z.object({
  id: z.uuid(), title: z.string(), message: z.string(), linkPath: z.string().regex(/^\/(?![\/\\])/),
  readAt: z.iso.datetime().nullable(), createdAt: z.iso.datetime(),
});
const inbox = z.object({ notifications: z.array(notification), hasMore: z.boolean() });
export type Inbox = z.infer<typeof inbox>;

export async function listNotifications(page: number) {
  return inbox.parse(await apiRequest('/notifications?page=' + page));
}
export async function unreadCount() {
  return z.object({ count: z.number().int().nonnegative() }).parse(await apiRequest('/notifications/unread-count')).count;
}
export async function markRead(id?: string) {
  await apiRequest(id ? `/notifications/${id}/read` : '/notifications/read-all', { method: 'POST' });
  window.dispatchEvent(new Event('notifications-read'));
}
