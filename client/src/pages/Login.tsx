import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate } from 'react-router';
import { authAction } from '../api/auth';
import { ApiError } from '../api/client';
import { AuthCard } from '../components/AuthCard';
import { Feedback } from '../components/Feedback';
import { FormField } from '../components/FormField';
import { useAuth } from '../context/AuthContext';
import { errorMessage, formResolver, loginForm } from '../lib/auth-forms';

export function Login() {
  const { status, signIn } = useAuth();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: formResolver(loginForm),
  });
  const [failure, setFailure] = useState('');
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [clock, setClock] = useState(Date.now);
  const remaining = Math.max(0, Math.ceil((lockedUntil - clock) / 1000));

  const showCountdown = remaining > 0;

  useEffect(() => {
    if (!showCountdown) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [showCountdown]);

  if (status === 'authenticated') return <Navigate to="/" replace />;

  function clearFeedback() {
    setFailure('');
    setUnverifiedEmail('');
    setResent(false);
    setLockedUntil(0);
  }

  const submit = handleSubmit(async (values) => {
    clearFeedback();
    try {
      await signIn(values);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'ACCOUNT_LOCKED' && error.lockedUntil) {
        setClock(Date.now());
        setLockedUntil(Date.parse(error.lockedUntil));
      } else if (error instanceof ApiError && error.status === 403 && error.message === 'Verify your email before logging in.') {
        setUnverifiedEmail(values.email);
      } else {
        setFailure(error instanceof ApiError && error.status === 401
          ? 'Your email or password is incorrect.'
          : errorMessage(error));
      }
    }
  });

  async function resend() {
    setResending(true);
    setFailure('');
    try {
      await authAction('resend-verification', { email: unverifiedEmail });
      setResent(true);
    } catch (error) {
      setFailure(errorMessage(error));
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthCard title="Log in" description="Sign in to your campus account.">
      <form className="space-y-4" onSubmit={submit} onChange={clearFeedback} noValidate>
        {failure && <Feedback tone="error">{failure}</Feedback>}
        {remaining > 0 && (
          <Feedback tone="error" live={false}>
            Account locked. Try again in {Math.floor(remaining / 60)} min {remaining % 60} sec.
          </Feedback>
        )}
        {lockedUntil > 0 && remaining === 0 && <Feedback tone="info">You can try logging in again.</Feedback>}
        {unverifiedEmail && (
          <div className="space-y-2">
            <Feedback tone="info">Verify your email before logging in.</Feedback>
            {resent
              ? <Feedback tone="success">If your account needs verification, a new email will arrive shortly.</Feedback>
              : <button className="secondary-button" type="button" disabled={resending} onClick={() => void resend()}>
                  {resending ? 'Sending…' : 'Resend verification'}
                </button>}
          </div>
        )}
        <fieldset disabled={isSubmitting || resending} className="space-y-4">
          <FormField label="Email" type="email" autoComplete="username" registration={register('email')} error={errors.email?.message} />
          <FormField label="Password" type="password" autoComplete="current-password" registration={register('password')} error={errors.password?.message} />
        </fieldset>
        <div className="text-right text-sm"><Link className="auth-link" to="/forgot-password">Forgot password?</Link></div>
        <button className="primary-button w-full" disabled={isSubmitting || resending || remaining > 0}>
          {isSubmitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-muted">New to CampusConnect? <Link className="auth-link" to="/signup">Sign up</Link></p>
    </AuthCard>
  );
}
