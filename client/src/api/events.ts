import { z } from 'zod';
import { apiRequest } from './client';
import { EVENT_CATEGORIES, INTERESTS } from '../lib/event-constants';

export const eventCategory = z.enum(EVENT_CATEGORIES);
export type Category = z.infer<typeof eventCategory>;

const event = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string(),
  category: eventCategory,
  tags: z.array(z.enum(INTERESTS)),
  venue: z.string(),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  capacity: z.number(),
  seatsLeft: z.number(),
  clubName: z.string(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
  rejectionReason: z.string().nullable(),
  organizerId: z.uuid(),
});
export type CampusEvent = z.infer<typeof event>;
export type EventInput = Pick<CampusEvent, 'title' | 'description' | 'category' | 'tags' | 'venue' | 'startsAt' | 'endsAt' | 'capacity' | 'clubName'>;

const eventResponse = z.object({ event });
const listResponse = z.object({ events: z.array(event), page: z.number(), hasMore: z.boolean() });

export async function listEvents({ mine, q, category, page }: {
  mine: boolean; q: string; category: Category | ''; page: number;
}) {
  const params = new URLSearchParams({ page: String(page) });
  if (q) params.set('q', q);
  if (category) params.set('category', category);
  return listResponse.parse(await apiRequest(`/events${mine ? '/mine' : ''}?${params}`));
}

export async function getEvent(id: string) {
  return eventResponse.parse(await apiRequest(`/events/${encodeURIComponent(id)}`)).event;
}

export async function saveEvent(fields: Partial<EventInput>, id?: string) {
  const path = id ? `/events/${encodeURIComponent(id)}` : '/events';
  return eventResponse.parse(await apiRequest(path, { method: id ? 'PATCH' : 'POST', body: fields })).event;
}

export async function deleteEvent(id: string) {
  await apiRequest(`/events/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
