import { sendMail } from './mail.ts';

export async function sendAuthEmail(email: string, purpose: 'verify-email' | 'reset-password', token: string) {
  const link = new URL(`/${purpose}`, process.env.CLIENT_URL);
  link.searchParams.set('token', token);
  const action = purpose === 'verify-email' ? 'Verify your email' : 'Reset your password';
  await sendMail({
    to: email,
    subject: `${action} | CampusConnect`,
    text: `${action} using this link:\n${link.href}\n\nIf you did not request this, ignore this email.`,
  });
}
