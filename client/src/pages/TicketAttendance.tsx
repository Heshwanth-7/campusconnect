import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { loadAttendance, loadTicket } from '../api/checkin';
import { Feedback } from '../components/Feedback';
import { formatEventTime } from '../lib/event-time';
import { errorMessage } from '../lib/auth-forms';

function usePageData<T>(load: (id: string) => Promise<T>) {
  const { id } = useParams();
  const [state, setState] = useState<{ id: string; data?: T; error?: string }>();
  useEffect(() => {
    if (!id) return;
    let active = true;
    void load(id).then(data => { if (active) setState({ id, data }); },
      error => { if (active) setState({ id, error: errorMessage(error) }); });
    return () => { active = false; };
  }, [id, load]);
  return state?.id === id ? state : undefined;
}

export function Ticket() {
  const state = usePageData(loadTicket);
  const ticket = state?.data;
  return <main className="mx-auto max-w-lg space-y-4 px-4 py-6">
    <Link className="auth-link" to="/registrations/mine">← My registrations</Link>
    <h1 className="text-2xl font-semibold">Your ticket</h1>
    {state?.error && <Feedback tone="error">{state.error}</Feedback>}
    {!state && <Feedback tone="info">Loading ticket…</Feedback>}
    {ticket && <article className="space-y-3 rounded-xl border border-border bg-white p-4 shadow-sm">
      <h2 className="break-words text-xl font-semibold">{ticket.event.title}</h2>
      <p><time dateTime={ticket.event.startsAt}>{formatEventTime(ticket.event.startsAt)}</time></p>
      <p className="break-words">{ticket.studentName}</p>
      <img className="mx-auto block h-auto w-full max-w-96" width="640" height="640" src={ticket.image} alt="Single-use admission QR ticket" />
      <details><summary className="cursor-pointer py-3 text-primary">Show token for manual check-in</summary>
        <code className="block select-all break-all text-sm">{ticket.token}</code></details>
    </article>}
  </main>;
}

export function Attendance() {
  const state = usePageData(loadAttendance);
  const data = state?.data;
  const { id } = useParams();
  return <main className="mx-auto max-w-xl space-y-4 px-4 py-6">
    <Link className="auth-link" to={`/events/${id}`}>← Event details</Link>
    <h1 className="text-2xl font-semibold">Attendance</h1>
    {state?.error && <Feedback tone="error">{state.error}</Feedback>}
    {!state && <Feedback tone="info">Loading attendance…</Feedback>}
    {data && <>
      <p>{data.checkedIn} of {data.registered} registered students checked in</p>
      <progress aria-label="Check-in progress" className="w-full accent-primary" value={data.checkedIn} max={data.registered || 1} />
      {data.registered === 0 && <p>No confirmed registrations yet.</p>}
      <ul className="divide-y divide-border rounded-xl bg-white px-4 shadow-sm">
        {data.registrations.map(row => <li key={row.id} className="flex flex-wrap justify-between gap-2 py-3">
          <strong className="break-all">{row.user.name}</strong>
          <span>{row.checkedInAt ? '✓ Checked in' : '○ Awaiting check-in'}</span>
        </li>)}
      </ul>
    </>}
  </main>;
}
