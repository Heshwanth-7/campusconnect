import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { listEvents } from '../api/events';
import type { CampusEvent, Category } from '../api/events';
import { CategoryBadge, EventPoster, categoryLabels, EventStatusBadge } from '../components/EventBadges';
import { Feedback } from '../components/Feedback';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../lib/auth-forms';
import { EVENT_CATEGORIES } from '../lib/event-constants';
import { formatEventTime } from '../lib/event-time';

type Filters = { mine: boolean; q: string; category: Category | '' };

function EventResults(filters: Filters) {
  const { mine, q, category } = filters;
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void listEvents({ mine, q, category, page: 1 }).then((result) => {
      if (!active) return;
      setEvents(result.events);
      setPage(result.page);
      setHasMore(result.hasMore);
    }).catch((error: unknown) => { if (active) setError(errorMessage(error)); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [mine, q, category]);

  async function more() {
    setBusy(true);
    setError('');
    try {
      const result = await listEvents({ mine, q, category, page: page + 1 });
      setEvents((current) => [...current, ...result.events.filter((event) => !current.some(({ id }) => id === event.id))]);
      setPage(result.page);
      setHasMore(result.hasMore);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && <Feedback tone="error">{error}</Feedback>}
      {!page && busy && <Feedback tone="info">Loading events…</Feedback>}
      {page > 0 && !events.length && <Feedback tone="info">{mine ? 'No events match your filters.' : 'No events found.'}</Feedback>}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((event) => (
          <li key={event.id} className="min-w-0 space-y-2 rounded-xl border border-border bg-surface p-4 shadow-sm">
            <EventPoster event={event} />
            <div className="flex flex-wrap gap-2">
              <CategoryBadge category={event.category} />
              {(mine || event.status !== 'APPROVED') && <EventStatusBadge status={event.status} />}
            </div>
            <h2 className="break-words text-lg font-semibold">
              <Link className="auth-link" to={`/events/${event.id}`}>{event.title}</Link>
            </h2>
            <p className="break-words text-sm text-muted">{event.clubName} · {event.venue}</p>
            <p className="text-sm"><time dateTime={event.startsAt}>{formatEventTime(event.startsAt)}</time></p>
            <p className="text-sm text-muted">{event.seatsLeft} seats left</p>
            {mine && <Link className="secondary-button inline-flex" to={`/events/${event.id}/edit`}>Edit event</Link>}
          </li>
        ))}
      </ul>
      {(hasMore || (!page && error)) && (
        <button className="secondary-button" disabled={busy} onClick={() => void more()}>
          {busy ? 'Loading…' : page ? 'Load more' : 'Try again'}
        </button>
      )}
    </div>
  );
}

export function Events({ mine = false }: { mine?: boolean }) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [q, setQuery] = useState('');
  const [category, setCategory] = useState<Category | ''>('');
  const canCreate = user?.role === 'ORGANIZER' || user?.role === 'ADMIN';

  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 md:px-8 md:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{mine ? 'My Events' : 'Events'}</h1>
        {canCreate && <Link to="/events/new" className="primary-button inline-flex min-h-11">Create event</Link>}
      </div>
      <form role="search" className="flex gap-2" onSubmit={(event) => { event.preventDefault(); setQuery(search.trim()); }}>
        <input className="auth-input min-w-0" type="search" aria-label="Search events" placeholder="Search events" maxLength={160}
          value={search} onChange={(event) => { setSearch(event.target.value); if (!event.target.value) setQuery(''); }} />
        <button className="secondary-button shrink-0">Search</button>
      </form>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Event categories">
        {(['', ...EVENT_CATEGORIES] as const).map((value) => (
          <button key={value} type="button" aria-pressed={category === value}
            className={`rounded-xl border px-3 text-sm font-semibold ${category === value ? 'border-primary bg-primary-tint text-primary-hover' : 'border-border bg-surface'}`}
            onClick={() => setCategory(value)}>
            {value ? categoryLabels[value] : 'All categories'}
          </button>
        ))}
      </div>
      <EventResults key={JSON.stringify([mine, q, category])} mine={mine} q={q} category={category} />
    </main>
  );
}
