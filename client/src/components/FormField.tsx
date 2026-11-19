import { useId, useState } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';

export function FormField({ label, registration, type = 'text', autoComplete, error, hint }: {
  label: string;
  registration: UseFormRegisterReturn;
  type?: 'text' | 'email' | 'password';
  autoComplete: string;
  error?: string;
  hint?: string;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const password = type === 'password';
  const descriptionIds = [error && id + '-error', hint && id + '-hint'].filter(Boolean).join(' ');

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold">{label}</label>
      <div className="relative">
        <input
          id={id}
          {...registration}
          type={password && visible ? 'text' : type}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={descriptionIds || undefined}
          className={`auth-input ${password ? 'pr-20' : ''}`}
        />
        {password && (
          <button
            type="button"
            className="absolute inset-y-0 right-1 px-3 text-sm font-semibold text-primary"
            aria-label={visible ? 'Hide password' : 'Show password'}
            aria-controls={id}
            onClick={() => setVisible(!visible)}
          >
            {visible ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
      {hint && <p id={`${id}-hint`} className="text-sm text-muted">{hint}</p>}
      {error && <p id={`${id}-error`} className="text-sm font-medium text-red-800"><span aria-hidden="true">⚠ </span>{error}</p>}
    </div>
  );
}
