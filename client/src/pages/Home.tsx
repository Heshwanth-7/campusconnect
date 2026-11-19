import { useState } from 'react';
import { Feedback } from '../components/Feedback';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../lib/auth-forms';

export function Home() {
  const { user, signOut } = useAuth();
  const firstName = user?.name.trim().split(/\s+/, 1)[0];
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');

  async function logout() {
    setBusy(true);
    setFailure('');
    try {
      await signOut();
    } catch (error) {
      setFailure(errorMessage(error));
      setBusy(false);
    }
  }

  return (
    <>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <span className="font-semibold tracking-tight">CampusConnect</span>
          <button className="secondary-button shrink-0" disabled={busy} onClick={() => void logout()}>
            {busy ? 'Logging out…' : 'Log out'}
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-8 sm:px-8 sm:py-14">
        {failure && <Feedback tone="error">{failure}</Feedback>}
        <section className="rounded-xl border border-border bg-surface p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight break-words">Welcome, {firstName}</h1>
          <p className="mt-2 text-sm text-muted">Your campus home page is coming soon.</p>
        </section>
      </main>
    </>
  );
}
