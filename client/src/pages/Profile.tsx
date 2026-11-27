import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate } from 'react-router';
import { z } from 'zod';
import { Feedback } from '../components/Feedback';
import { useAuth } from '../context/AuthContext';
import { errorMessage, formResolver } from '../lib/auth-forms';
import { INTERESTS } from '../lib/event-constants';

const preferences = z.object({ interests: z.array(z.enum(INTERESTS)) });

export function Profile({ onboarding = false }: { onboarding?: boolean }) {
  const { user, saveInterests } = useAuth();
  const navigate = useNavigate();
  const [failure, setFailure] = useState('');
  const { register, handleSubmit, formState: { isSubmitting } } = useForm({
    resolver: formResolver(preferences),
    defaultValues: { interests: user?.interests ?? [] },
  });
  const submit = handleSubmit(async ({ interests }) => {
    setFailure('');
    try {
      await saveInterests(interests);
      void navigate('/', { replace: onboarding });
    } catch (error) {
      setFailure(errorMessage(error));
    }
  });
  if (onboarding && user?.interestsOnboarded) return <Navigate to="/" replace />;
  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 py-8">
      <h1 className="text-2xl font-semibold">{onboarding ? 'What interests you?' : 'Profile'}</h1>
      <form onSubmit={submit} className="space-y-5 rounded-xl border border-border bg-surface p-5 shadow-sm">
        <fieldset disabled={isSubmitting}>
          <legend className="font-semibold">Your interests</legend>
          <p className="my-3 text-sm text-muted">Choose topics for your For You feed, or leave them empty to see events by date.</p>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map(interest => (
              <label key={interest} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border px-3 capitalize has-checked:border-primary has-checked:bg-primary-tint">
                <input type="checkbox" value={interest} {...register('interests')} className="accent-primary" />{interest}
              </label>
            ))}
          </div>
        </fieldset>
        {failure && <Feedback tone="error">{failure}</Feedback>}
        <div className="flex flex-wrap items-center gap-4">
          <button className="primary-button" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : onboarding ? 'Continue' : 'Save interests'}</button>
          {!onboarding && <Link to="/" className="auth-link">Cancel</Link>}
        </div>
      </form>
    </main>
  );
}
