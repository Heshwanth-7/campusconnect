import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { authAction } from '../api/auth';
import { AuthCard } from '../components/AuthCard';
import { Feedback } from '../components/Feedback';
import { FormField } from '../components/FormField';
import { useLinkToken } from '../hooks/useLinkToken';
import { errorMessage, formResolver, passwordHint, resetForm } from '../lib/auth-forms';

export function ResetPassword() {
  const token = useLinkToken();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: formResolver(resetForm),
  });
  const [submitted, setSubmitted] = useState(false);
  const [failure, setFailure] = useState('');

  const submit = handleSubmit(async ({ password }) => {
    if (!token) return;
    setFailure('');
    try {
      await authAction('reset-password', { token, password });
      setSubmitted(true);
    } catch (error) {
      setFailure(errorMessage(error));
    }
  });

  return (
    <AuthCard title="Reset your password">
      {!token ? (
        <Feedback tone="error">This reset link is missing or invalid. <Link className="auth-link" to="/forgot-password">Request another link.</Link></Feedback>
      ) : submitted ? (
        <Feedback tone="info">If the link was valid, your new password is ready to use.</Feedback>
      ) : (
        <form className="space-y-4" onSubmit={submit} noValidate>
          {failure && <Feedback tone="error">{failure}</Feedback>}
          <fieldset disabled={isSubmitting}>
            <FormField label="New password" type="password" autoComplete="new-password" registration={register('password')} error={errors.password?.message} hint={passwordHint} />
          </fieldset>
          <button className="primary-button w-full" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Reset password'}</button>
        </form>
      )}
      <p className="mt-5 text-center text-sm"><Link className="auth-link" to="/login">Back to login</Link></p>
    </AuthCard>
  );
}
