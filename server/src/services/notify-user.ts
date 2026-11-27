import type { NotificationType, Prisma } from '../generated/prisma/client.ts';
import { db } from '../utils/prisma.ts';
import { sendMail } from './mail.ts';

export const maxAttempts = 3;
const titles: Record<NotificationType, string> = {
  SEAT_CONFIRMED: 'Seat confirmed',
  WAITLIST_PROMOTED: 'A seat opened up',
  EVENT_REMINDER: 'Event reminder',
  MATCH_FOUND: 'Possible item match',
  MATCH_CONFIRMED: 'Item match confirmed',
  EVENT_APPROVED: 'Event approved',
  EVENT_REJECTED: 'Event rejected',
};

type Payload = { message: string; linkPath: string };

export function saveNotification(tx: Prisma.TransactionClient, userId: string, type: NotificationType, payload: Payload) {
  return tx.notification.create({ data: { userId, type, title: titles[type], ...payload }, select: { id: true } });
}

function escapeHtml(text: string) {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

export async function deliverEmail(id: string) {
  // Reserve one attempt before SMTP. A crashed worker's lease expires for the next retry.
  const now = new Date();
  const lease = new Date(+now + 5 * 60_000);
  const { count } = await db().notification.updateMany({
    where: { id, emailSentAt: null, emailAttempts: { lt: maxAttempts },
      OR: [{ emailLeaseUntil: null }, { emailLeaseUntil: { lte: now } }] },
    data: { emailAttempts: { increment: 1 }, emailLeaseUntil: lease },
  });
  if (!count) return;
  const notice = await db().notification.findUnique({
    where: { id }, include: { user: { select: { email: true } } },
  });
  if (!notice) return;
  let emailSentAt: Date | null = null;
  try {
    const url = new URL(notice.linkPath, process.env.CLIENT_URL);
    const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
      <body style="font-family:Arial,sans-serif;color:#0F172A"><main style="max-width:560px;margin:auto">
      <header style="padding:18px;background:#4F46E5;color:white">CampusConnect</header>
      <h1>${escapeHtml(notice.title)}</h1><p>${escapeHtml(notice.message)}</p>
      <a style="display:inline-block;padding:14px;background:#4F46E5;color:white;border-radius:12px" href="${escapeHtml(url.href)}">View details</a>
      </main></body></html>`;
    await sendMail({ to: notice.user.email, subject: notice.title,
      text: `${notice.title}\n\n${notice.message}\n\nView details: ${url.href}`, html });
    emailSentAt = new Date();
  } catch {
    console.warn('Notification email delivery failed.');
  }
  await db().notification.updateMany({ where: { id, emailLeaseUntil: lease }, data: { emailSentAt, emailLeaseUntil: null } });
}

export async function notifyUser(userId: string, type: NotificationType, payload: Payload) {
  const { id } = await saveNotification(db(), userId, type, payload);
  await deliverEmail(id);
}
