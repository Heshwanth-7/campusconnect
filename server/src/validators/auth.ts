import { z } from 'zod';
import { opaqueToken } from '../utils/auth-tokens.ts';

const email = z.string().trim().toLowerCase().pipe(z.email().max(254));
const password = z.string().min(8).max(256)
  .regex(/\p{L}/u).regex(/\p{N}/u).regex(/[^\p{L}\p{N}\s]/u);
export const emailInput = z.object({ email });
export const registrationInput = emailInput.extend({ name: z.string().trim().min(1).max(120), password });
export const loginInput = emailInput.extend({ password: z.string().min(1).max(256) });
export const verificationInput = z.object({ token: opaqueToken });
export const resetInput = verificationInput.extend({ password });
