import { z } from 'zod';
import { apiRequest } from './client';

export const registrationStatus = z.enum(['CONFIRMED', 'WAITLISTED', 'CANCELLED']);
export type RegistrationStatus = z.infer<typeof registrationStatus>;

const registrationResult = z.object({
  seatsLeft: z.number(),
  myRegistrationStatus: registrationStatus.nullable(),
  myWaitlistPosition: z.number().nullable(),
});
export type RegistrationResult = z.infer<typeof registrationResult>;

const myRegistrations = z.object({
  registrations: z.array(z.object({
    id: z.uuid(),
    status: registrationStatus,
    waitlistPosition: z.number().nullable(),
    event: z.object({ id: z.uuid(), title: z.string(), startsAt: z.iso.datetime(), venue: z.string() }),
  })),
});
export type MyRegistration = z.infer<typeof myRegistrations>['registrations'][number];

export async function changeRegistration(eventId: string, method: 'POST' | 'DELETE') {
  return registrationResult.parse(await apiRequest(`/events/${encodeURIComponent(eventId)}/register`, { method }));
}

export async function listMyRegistrations() {
  return myRegistrations.parse(await apiRequest('/registrations/mine')).registrations;
}
