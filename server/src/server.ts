import { z } from 'zod';
import cron from 'node-cron';
import { retryEmails, sendReminders } from './services/notification-jobs.ts';
import { app } from './app.ts';

import { accessSecret } from './utils/auth-tokens.ts';
import { qrSecret } from './utils/qr-token.ts';

accessSecret();
qrSecret();
const port = z.coerce.number().int().min(1).max(65535).parse(process.env.PORT ?? 3000);
const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';
app.listen(port, host, () => {
  if (process.env.NODE_ENV !== 'test') {
    cron.schedule('*/5 * * * *', () => retryEmails().catch(() => console.warn('Email retry job failed.')), { noOverlap: true });
    cron.schedule('0 * * * *', () => sendReminders().catch(() => console.warn('Reminder job failed.')), { noOverlap: true });
  }
  console.log(`CampusConnect API listening on port ${port}`);
});
