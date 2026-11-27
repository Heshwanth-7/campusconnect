import { Link } from 'react-router';
import { getFeed, type FeedEvent } from '../api/events';
import { CategoryBadge, EventPoster } from '../components/EventBadges';
import { formatEventTime } from '../lib/event-time';
import { useEffect, useState } from 'react';
import { Feedback } from '../components/Feedback';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../lib/auth-forms';

export function Home() {
  const { user, signOut } = useAuth();
  const [events, setEvents] = useState<FeedEvent[] | null>(null);
  const [feedError, setFeedError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setFeedError('');
    setEvents(null);
    void getFeed().then(result => { if (active) setEvents(result); })
      .catch(error => { if (active) setFeedError(errorMessage(error)); });
    return () => { active = false; };
  }, [user, attempt]);
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
          <Link className="auth-link" to="/profile">Profile</Link>
          {user?.role === 'ADMIN' && <Link className="auth-link" to="/admin">Admin Panel</Link>}
          <button className="secondary-button shrink-0" disabled={busy} onClick={() => void logout()}>
            {busy ? 'Logging out…' : 'Log out'}
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-8 sm:px-8 sm:py-14">
        {failure && <Feedback tone="error">{failure}</Feedback>}
        <h1 className="text-2xl font-semibold tracking-tight">For You</h1>
        {!user?.interests.length && (
          <section className="space-y-2 rounded-xl border border-border bg-surface p-5 shadow-sm">
            <h2 className="font-semibold">Make this feed yours</h2>
            <p className="text-sm text-muted">For now, upcoming events appear by date. Pick a few interests to see your best matches first.</p>
            <Link to="/profile" className="auth-link">Pick interests</Link>
          </section>
        )}
        {feedError && <>
          <Feedback tone="error">{feedError}</Feedback>
          <button className="secondary-button" onClick={() => setAttempt(value => value + 1)}>Try again</button>
        </>}
        {!events && !feedError && <Feedback tone="info">Loading events…</Feedback>}
        {events?.length === 0 && <Feedback tone="info">No upcoming events to recommend right now.</Feedback>}
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events?.map(event => (
            <li key={event.id} className="min-w-0 space-y-2 rounded-xl border border-border bg-surface p-4 shadow-sm">
              <EventPoster event={event} />
              <CategoryBadge category={event.category} />
              <h2 className="break-words text-lg font-semibold"><Link className="auth-link" to={`/events/${event.id}`}>{event.title}</Link></h2>
              <p className="break-words text-sm text-muted">{event.clubName} · {event.venue}</p>
              <time className="text-sm" dateTime={event.startsAt}>{formatEventTime(event.startsAt)}</time>
              <ul aria-label="Why this event appears" className="flex flex-wrap gap-2">
                {event.reasons.map(reason => <li key={reason} className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-text">{reason}</li>)}
              </ul>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
