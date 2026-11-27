import { db } from '../utils/prisma.ts';
import { deliverEmail, maxAttempts, saveNotification } from './notify-user.ts';

export async function retryEmails() {
  const pending = await db().notification.findMany({
    where: { emailSentAt: null, emailAttempts: { lt: maxAttempts },
      OR: [{ emailLeaseUntil: null }, { emailLeaseUntil: { lte: new Date() } }] },
    select: { id: true },
  });
  for (const { id } of pending) await deliverEmail(id);
}

export async function sendReminders(now = new Date()) {
  const eligible = {
    status: 'CONFIRMED' as const, reminderSentAt: null,
    event: { startsAt: { gt: now, lte: new Date(+now + 86_400_000) } },
  };
  const registrations = await db().registration.findMany({
    where: eligible, select: { id: true, userId: true, event: { select: { id: true, title: true } } },
  });
  for (const { id, userId, event } of registrations) {
    const notice = await db().$transaction(async tx => {
      const { count } = await tx.registration.updateMany({ where: { id, ...eligible }, data: { reminderSentAt: now } });
      if (count === 1) return saveNotification(tx, userId, 'EVENT_REMINDER', {
        message: `${event.title} starts within 24 hours.`, linkPath: '/events/' + event.id,
      });
    });
    if (notice) await deliverEmail(notice.id);
  }
}
