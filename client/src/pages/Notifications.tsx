import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { listNotifications, markRead, type Inbox } from '../api/notifications';
import { Feedback } from '../components/Feedback';
import { errorMessage } from '../lib/auth-forms';

export function Notifications() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Inbox>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setData(undefined);
    setError('');
    listNotifications(page).then(result => { if (active) setData(result); })
      .catch(reason => { if (active) setError(errorMessage(reason)); });
    return () => { active = false; };
  }, [page]);
  async function read(item?: Inbox['notifications'][number]) {
    setError('');
    setBusy(true);
    try {
      if (!item?.readAt) await markRead(item?.id);
      if (item) navigate(item.linkPath);
      else setData(await listNotifications(page));
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }

  return <main className="mx-auto max-w-3xl space-y-4 p-4 sm:p-8">
    <header className="flex flex-wrap items-center justify-between gap-2">
      <h1 className="text-2xl font-semibold">Notifications</h1>
      {!!data?.notifications.length && <button className="secondary-button" disabled={busy} onClick={() => void read()}>Mark all as read</button>}
    </header>
    {error && <Feedback tone="error">{error}</Feedback>}
    {!data && !error && <p role="status">Loading notifications…</p>}
    {data?.notifications.length === 0 && <p>No notifications yet.</p>}
    {data?.notifications.map(item => <button key={item.id} disabled={busy} onClick={() => void read(item)}
      className="block w-full space-y-1 rounded-xl border border-border bg-surface p-4 text-left shadow-sm hover:border-primary">
      <span className="block text-xs text-muted">{item.readAt ? '✓ Read' : '● Unread'} · {new Date(item.createdAt).toLocaleString()}</span>
      <strong className="block">{item.title}</strong><span className="block wrap-anywhere">{item.message}</span>
    </button>)}
    {(page > 1 || data?.hasMore) && <nav aria-label="Notification pages" className="flex justify-between gap-3">
      <button className="secondary-button" disabled={busy || page === 1} onClick={() => setPage(page - 1)}>Previous</button>
      <button className="secondary-button" disabled={busy || !data?.hasMore} onClick={() => setPage(page + 1)}>Next</button>
    </nav>}
  </main>;
}
