import type { FieldErrors, FieldPath, FieldValues, Resolver } from 'react-hook-form';
import { z } from 'zod';

const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address.').max(254));
const strongPassword = z.string().min(8, 'Use at least 8 characters.').max(256)
  .regex(/\p{L}/u, 'Include a letter.').regex(/\p{N}/u, 'Include a number.')
  .regex(/[^\p{L}\p{N}\s]/u, 'Use at least one special character, like ! or @.');

export const passwordHint = 'Use at least 8 characters, including a letter, a number, and a special character like ! or @.';

export const emailForm = z.object({ email });
export const loginForm = emailForm.extend({ password: z.string().min(1, 'Enter your password.').max(256) });
export const signupForm = emailForm.extend({
  name: z.string().trim().min(1, 'Enter your name.').max(120, 'Use no more than 120 characters.'),
  password: strongPassword,
});
export const resetForm = z.object({ password: strongPassword });
export const linkToken = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

// The forms are flat, so each Zod issue maps directly to one registered field.
export function formResolver<Fields extends FieldValues>(schema: z.ZodType<Fields, Fields>): Resolver<Fields> {
  return (values) => {
    const result = schema.safeParse(values);
    if (result.success) return { values: result.data, errors: {} };

    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0] as FieldPath<Fields>;
      if (field && !errors[field]) errors[field] = { type: issue.code, message: issue.message };
    }
    return { values: {}, errors: errors as FieldErrors<Fields> };
  };
}

export function errorMessage(error: unknown) {
  if (error instanceof Error && !(error instanceof TypeError)) return error.message;
  return 'Could not reach CampusConnect. Check your connection and try again.';
}
