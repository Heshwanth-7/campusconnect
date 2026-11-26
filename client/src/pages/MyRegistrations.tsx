import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { changeRegistration, listMyRegistrations } from '../api/registrations';
import type { MyRegistration } from '../api/registrations';
import { Feedback } from '../components/Feedback';
import { RegistrationStatus } from '../components/RegistrationStatus';
import { errorMessage } from '../lib/auth-forms';
import { formatEventTime } from '../lib/event-time';

export function MyRegistrations() {
  const [items, setItems] = useState<MyRegistration[]>();
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState<string>();

  useEffect(() => {
    let active = true;
    void listMyRegistrations().then(
      (rows) => { if (active) setItems(rows); },
      (failure: unknown) => { if (active) setError(errorMessage(failure)); },
    );
    return () => { active = false; };
  }, []);

  async function cancel(item: MyRegistration) {
    setCancelling(item.id);
    setError('');
    try {
      await changeRegistration(item.event.id, 'DELETE');
      setItems((current) => current?.map((row) => row.id === item.id
        ? { ...row, status: 'CANCELLED', waitlistPosition: null } : row));
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setCancelling(undefined);
    }
  }

  return (
    <main className="mx-auto max-w-4xl space-y-4 px-4 py-6 md:px-8 md:py-10">
      <h1 className="text-2xl font-semibold">My Registrations</h1>
      {error && <Feedback tone="error">{error}</Feedback>}
      {!items && !error && <Feedback tone="info">Loading registrations…</Feedback>}
      {items?.length === 0 && <Feedback tone="info">You haven’t registered for any events yet. <Link className="auth-link" to="/events">Browse events</Link></Feedback>}
      <ul className="space-y-3">
        {items?.map((item) => (
          <li key={item.id} className="space-y-3 rounded-xl border border-border bg-surface p-4 shadow-sm">
            <h2 className="break-words text-lg font-semibold"><Link className="auth-link" to={`/events/${item.event.id}`}>{item.event.title}</Link></h2>
            <p className="break-words text-sm text-muted"><time dateTime={item.event.startsAt}>{formatEventTime(item.event.startsAt)}</time> · {item.event.venue}</p>
            <div className="flex flex-wrap items-center gap-2">
              <span role="status"><RegistrationStatus status={item.status} position={item.waitlistPosition} /></span>
              {item.status !== 'CANCELLED' && <button className="secondary-button" disabled={Boolean(cancelling)}
                onClick={() => void cancel(item)}>{cancelling === item.id ? 'Cancelling…' : 'Cancel registration'}</button>}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
