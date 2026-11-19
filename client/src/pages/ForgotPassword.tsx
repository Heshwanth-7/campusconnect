import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { authAction } from '../api/auth';
import { AuthCard } from '../components/AuthCard';
import { Feedback } from '../components/Feedback';
import { FormField } from '../components/FormField';
import { emailForm, errorMessage, formResolver } from '../lib/auth-forms';

export function ForgotPassword() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: formResolver(emailForm),
  });
  const [sent, setSent] = useState(false);
  const [failure, setFailure] = useState('');

  const submit = handleSubmit(async (values) => {
    setFailure('');
    try {
      await authAction('forgot-password', values);
      setSent(true);
    } catch (error) {
      setFailure(errorMessage(error));
    }
  });

  return (
    <AuthCard title="Forgot password?" description={sent ? undefined : 'Enter the email you use for CampusConnect.'}>
      {sent ? <Feedback tone="success">If an account exists for that email, a reset link will arrive shortly.</Feedback> : (
        <form className="space-y-4" onSubmit={submit} noValidate>
          {failure && <Feedback tone="error">{failure}</Feedback>}
          <fieldset disabled={isSubmitting}>
            <FormField label="Email" type="email" autoComplete="email" registration={register('email')} error={errors.email?.message} />
          </fieldset>
          <button className="primary-button w-full" disabled={isSubmitting}>{isSubmitting ? 'Sending…' : 'Send reset link'}</button>
        </form>
      )}
      <p className="mt-5 text-center text-sm"><Link className="auth-link" to="/login">Back to login</Link></p>
    </AuthCard>
  );
}
