import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { authAction } from '../api/auth';
import { AuthCard } from '../components/AuthCard';
import { Feedback } from '../components/Feedback';
import { FormField } from '../components/FormField';
import { errorMessage, formResolver, passwordHint, signupForm } from '../lib/auth-forms';

export function SignUp() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: formResolver(signupForm),
  });
  const [failure, setFailure] = useState('');
  const [created, setCreated] = useState(false);

  const submit = handleSubmit(async (values) => {
    setFailure('');
    try {
      await authAction('register', values);
      setCreated(true);
    } catch (error) {
      setFailure(errorMessage(error));
    }
  });

  return (
    <AuthCard title={created ? 'Check your email' : 'Create an account'} description={created ? undefined : 'Sign up with your college email.'}>
      {created ? (
        <Feedback tone="success">Open the verification link in your email to finish signing up.</Feedback>
      ) : (
        <form className="space-y-4" onSubmit={submit} noValidate>
          {failure && <Feedback tone="error">{failure}</Feedback>}
          <fieldset disabled={isSubmitting} className="space-y-4">
            <FormField label="Full name" autoComplete="name" registration={register('name')} error={errors.name?.message} />
            <FormField label="Email" type="email" autoComplete="email" registration={register('email')} error={errors.email?.message} />
            <FormField label="Password" type="password" autoComplete="new-password" registration={register('password')} error={errors.password?.message} hint={passwordHint} />
          </fieldset>
          <button className="primary-button w-full" disabled={isSubmitting}>{isSubmitting ? 'Creating account…' : 'Sign up'}</button>
        </form>
      )}
      <p className="mt-5 text-center text-sm text-muted"><Link className="auth-link" to="/login">Back to login</Link></p>
    </AuthCard>
  );
}
