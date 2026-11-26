import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { changeRegistration } from '../api/registrations';
import type { RegistrationResult } from '../api/registrations';
import { RegistrationStatus } from '../components/RegistrationStatus';
import { deleteEvent } from '../api/events';
import { CategoryBadge, EventStatusBadge } from '../components/EventBadges';
import { Feedback } from '../components/Feedback';
import { useAuth } from '../context/AuthContext';
import { useEvent } from '../hooks/useEvent';
import { errorMessage } from '../lib/auth-forms';
import { formatEventTime } from '../lib/event-time';

export function EventDetail() {
  const { id } = useParams();
  const result = useEvent(id);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [registration, setRegistration] = useState<{ eventId: string; summary: RegistrationResult }>();
  const [registrationBusy, setRegistrationBusy] = useState(false);
  const [registrationError, setRegistrationError] = useState('');
  const event = result?.event;
  const summary = registration && registration.eventId === event?.id ? registration.summary : event;
  const status = summary?.myRegistrationStatus;
  const active = status === 'CONFIRMED' || status === 'WAITLISTED';
  const open = event?.status === 'APPROVED' && Date.parse(event.startsAt) > Date.now();

  async function updateRegistration(method: 'POST' | 'DELETE') {
    if (!event) return;
    setRegistrationBusy(true);
    setRegistrationError('');
    try {
      setRegistration({ eventId: event.id, summary: await changeRegistration(event.id, method) });
    } catch (error) {
      setRegistrationError(errorMessage(error));
    } finally {
      setRegistrationBusy(false);
    }
  }

  async function remove() {
    if (!event || !window.confirm('Delete this event?')) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteEvent(event.id);
      void navigate('/events', { replace: true });
    } catch (error) {
      setDeleteError(errorMessage(error));
      setDeleting(false);
    }
  }

  const canManage = event && (user?.id === event.organizerId || user?.role === 'ADMIN');
  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-8 md:py-10">
      <Link to="/events" className="auth-link inline-flex min-h-11 items-center">← Back to events</Link>
      {!result && <Feedback tone="info">Loading event…</Feedback>}
      {result?.error && <Feedback tone="error">{result.error}</Feedback>}
      {event && (
        <article className="space-y-5 rounded-xl border border-border bg-surface p-5 shadow-sm sm:p-8">
          <div className="flex flex-wrap gap-2">
            <CategoryBadge category={event.category} />
            {canManage && <EventStatusBadge status={event.status} />}
          </div>
          <div>
            <h1 className="break-words text-2xl font-semibold">{event.title}</h1>
            <p className="mt-1 break-words text-muted">{event.clubName}</p>
          </div>
          <p className="whitespace-pre-wrap break-words">{event.description}</p>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="font-semibold">Starts</dt><dd><time dateTime={event.startsAt}>{formatEventTime(event.startsAt)}</time></dd></div>
            <div><dt className="font-semibold">Ends</dt><dd><time dateTime={event.endsAt}>{formatEventTime(event.endsAt)}</time></dd></div>
            <div><dt className="font-semibold">Venue</dt><dd className="break-words">{event.venue}</dd></div>
            <div><dt className="font-semibold">Seats left</dt><dd>{summary?.seatsLeft} of {event.capacity}</dd></div>
          </dl>
          {event.tags.length > 0 && (
            <ul aria-label="Event tags" className="flex flex-wrap gap-2">
              {event.tags.map((tag) => <li key={tag} className="rounded-full bg-primary-tint px-2.5 py-1 text-sm">{tag}</li>)}
            </ul>
          )}
          {canManage && event.status === 'REJECTED' && event.rejectionReason && <Feedback tone="error">{event.rejectionReason}</Feedback>}
          {deleteError && <Feedback tone="error">{deleteError}</Feedback>}
          {registrationError && <Feedback tone="error">{registrationError}</Feedback>}
          <div className="flex flex-wrap items-center gap-2">
            {active ? <>
              <span role="status"><RegistrationStatus status={status} position={summary?.myWaitlistPosition ?? null} /></span>
              <button type="button" className="secondary-button" disabled={registrationBusy}
                onClick={() => void updateRegistration('DELETE')}>{registrationBusy ? 'Cancelling…' : 'Cancel registration'}</button>
            </> : (
              <button type="button" className="primary-button" disabled={!open || registrationBusy}
                onClick={() => void updateRegistration('POST')}>
                {registrationBusy ? 'Registering…' : !open ? 'Registration closed' : summary?.seatsLeft === 0 ? 'Event full: join waitlist' : 'Register'}
              </button>
            )}
            {canManage && <>
              <Link className="secondary-button inline-flex" to={`/events/${event.id}/scanner`}>Scan tickets</Link>
              <Link className="secondary-button inline-flex" to={`/events/${event.id}/attendance`}>Attendance</Link>
              <Link className="secondary-button inline-flex" to={`/events/${event.id}/edit`}>Edit event</Link>
              <button className="secondary-button text-danger" disabled={deleting} onClick={() => void remove()}>
                {deleting ? 'Deleting…' : 'Delete event'}
              </button>
            </>}
          </div>
        </article>
      )}
    </main>
  );
}
