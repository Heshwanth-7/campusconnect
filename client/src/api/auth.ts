import { z } from 'zod';
import { apiRequest } from './client';

export const userRole = z.enum(['STUDENT', 'ORGANIZER', 'ADMIN']);
export type Role = z.infer<typeof userRole>;

const currentUser = z.object({
  user: z.object({
    id: z.uuid(),
    name: z.string(),
    email: z.email(),
    role: userRole,
  }),
});
export type User = z.infer<typeof currentUser>['user'];

export async function getCurrentUser() {
  return currentUser.parse(await apiRequest('/auth/me')).user;
}

export function authAction(action: string, body?: object) {
  // A public action's 401, such as invalid credentials, is not an expired session.
  return apiRequest(`/auth/${action}`, { method: 'POST', body, refresh: false });
}
