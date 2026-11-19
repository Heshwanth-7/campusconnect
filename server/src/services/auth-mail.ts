import nodemailer from 'nodemailer';
import { z } from 'zod';

const smtpConfig = z.object({
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535),
  SMTP_FROM: z.string().min(1),
});

export async function sendAuthEmail(email: string, purpose: 'verify-email' | 'reset-password', token: string) {
  const config = smtpConfig.safeParse(process.env);
  if (!config.success) throw new Error('SMTP configuration is missing or invalid.');
  const { SMTP_HOST, SMTP_PORT, SMTP_FROM } = config.data;
  const link = new URL(`/${purpose}`, process.env.CLIENT_URL);
  link.searchParams.set('token', token);
  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
  });
  const action = purpose === 'verify-email' ? 'Verify your email' : 'Reset your password';
  await transport.sendMail({
    from: SMTP_FROM,
    to: email,
    subject: `${action} | CampusConnect`,
    text: `${action} using this link:\n${link.href}\n\nIf you did not request this, ignore this email.`,
  });
}
