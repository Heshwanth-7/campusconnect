import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { authAction } from '../api/auth';
import { AuthCard } from '../components/AuthCard';
import { Feedback } from '../components/Feedback';
import { useLinkToken } from '../hooks/useLinkToken';
import { errorMessage } from '../lib/auth-forms';

export function VerifyEmail() {
  const token = useLinkToken();
  const request = useRef<Promise<unknown> | null>(null);
  const [verified, setVerified] = useState(false);
  const [failure, setFailure] = useState('');

  useEffect(() => {
    if (!token) return;
    let active = true;
    // The link is single-use. Reuse the request if Strict Mode runs this effect twice.
    request.current ??= authAction('verify-email', { token });
    void request.current.then(
      () => { if (active) setVerified(true); },
      (error: unknown) => { if (active) setFailure(errorMessage(error)); },
    );
    return () => { active = false; };
  }, [token]);

  return (
    <AuthCard title="Verify your email">
      {!token || failure ? (
        <Feedback tone="error">
          {failure || 'This verification link is missing or invalid.'} Log in to request a new link.
        </Feedback>
      ) : verified ? (
        <Feedback tone="success">Your email is verified. You can now log in.</Feedback>
      ) : (
        <Feedback tone="info">Verifying your email…</Feedback>
      )}
      <Link className="secondary-button mt-5 inline-flex" to="/login">Go to login</Link>
    </AuthCard>
  );
}
