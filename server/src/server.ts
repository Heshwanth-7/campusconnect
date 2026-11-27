import cron from 'node-cron';
import { retryEmails, sendReminders } from './services/notification-jobs.ts';
import { app } from './app.ts';

import { qrSecret } from './utils/qr-token.ts';

qrSecret();
app.listen(3000, '127.0.0.1', () => {
  if (process.env.NODE_ENV !== 'test') {
    cron.schedule('*/5 * * * *', () => retryEmails().catch(() => console.warn('Email retry job failed.')), { noOverlap: true });
    cron.schedule('0 * * * *', () => sendReminders().catch(() => console.warn('Reminder job failed.')), { noOverlap: true });
  }
  console.log('CampusConnect API listening on http://127.0.0.1:3000');
});
