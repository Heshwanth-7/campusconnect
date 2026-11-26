import { z } from 'zod';
import { apiRequest } from './client';

const ticket = z.object({ token: z.string(), studentName: z.string(),
  event: z.object({ title: z.string(), startsAt: z.iso.datetime() }) });
const attendance = z.object({ registered: z.int(), checkedIn: z.int(), registrations: z.array(z.object({
  id: z.uuid(), user: z.object({ name: z.string() }), checkedInAt: z.iso.datetime().nullable(),
})) });
const scan = z.discriminatedUnion('result', [
  z.object({ result: z.literal('SUCCESS'), studentName: z.string() }),
  z.object({ result: z.enum(['ALREADY_USED', 'INVALID', 'EXPIRED', 'WRONG_EVENT', 'NOT_CONFIRMED']) }),
]);
export type ScanResult = z.infer<typeof scan>;

export async function loadTicket(id: string) {
  const data = ticket.parse(await apiRequest(`/registrations/${id}/qr`));
  const { default: qr } = await import('qrcode');
  const image = await qr.toDataURL(data.token, { width: 640, margin: 4, color: { dark: '#000000', light: '#ffffff' } });
  return { ...data, image };
}

export async function loadAttendance(id: string) {
  return attendance.parse(await apiRequest(`/events/${id}/attendance`));
}

export async function scanTicket(eventId: string, token: string) {
  return scan.parse(await apiRequest('/checkin', { method: 'POST', body: { eventId, token } }));
}
