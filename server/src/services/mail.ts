import nodemailer from 'nodemailer';
import { z } from 'zod';

const smtpConfig = z.object({
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535),
  SMTP_FROM: z.string().min(1),
});

export async function sendMail(message: { to: string; subject: string; text: string; html?: string }) {
  const config = smtpConfig.safeParse(process.env);
  if (!config.success) throw new Error('SMTP configuration is missing or invalid.');
  const { SMTP_HOST, SMTP_PORT, SMTP_FROM } = config.data;
  const transport = nodemailer.createTransport({
    connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 10000,
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
  });
  await transport.sendMail({ ...message, from: SMTP_FROM });
}
