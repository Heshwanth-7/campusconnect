import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { z } from 'zod';
import { apiRequest } from '../../api/client';
import { Feedback } from '../../components/Feedback';
import { errorMessage } from '../../lib/auth-forms';

export const Revision = createContext(0);

export function Resource<T>({ path, schema, children }: {
  path: string; schema: z.ZodType<T>; children: (data: T) => ReactNode;
}) {
  const revision = useContext(Revision);
  const [data, setData] = useState<T>();
  const [failure, setFailure] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setFailure('');
    setData(undefined);
    void apiRequest(path).then(value => schema.parse(value)).then(value => { if (active) setData(value); })
      .catch(error => { if (active) setFailure(errorMessage(error)); });
    return () => { active = false; };
  }, [path, schema, attempt, revision]);
  if (failure) return <><Feedback tone="error">{failure}</Feedback><button className="secondary-button" onClick={() => setAttempt(attempt + 1)}>Try again</button></>;
  return data === undefined ? <Feedback tone="info">Loading…</Feedback> : children(data);
}

export function Table({ headings, children, empty }: { headings: string[]; children: ReactNode; empty: boolean }) {
  return <div className="admin-table" tabIndex={0} aria-label="Results" role="region"><table>
    <thead><tr>{headings.map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
    <tbody>{children}{empty && <tr><td colSpan={headings.length}>No results.</td></tr>}</tbody>
  </table></div>;
}
export function Pager({ page, more, go }: { page: number; more: boolean; go: (page: number) => void }) {
  return <div className="flex items-center justify-end gap-3 text-sm">
    <button className="secondary-button" disabled={page === 1} onClick={() => go(page - 1)}>Previous</button>
    Page {page}<button className="secondary-button" disabled={!more} onClick={() => go(page + 1)}>Next</button>
  </div>;
}
export function label(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase().replaceAll('_', ' ');
}
export type Action = { title: string; detail: string; path: string; method: 'POST' | 'PATCH' | 'DELETE'; body?: object; reason?: boolean };
export type Ask = (action: Action) => void;

export function Confirmation({ action, close, done }: { action: Action; close: () => void; done: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  useEffect(() => {
    const el = dialog.current!;
    el.showModal();
    return () => el.close();
  }, []);
  return <dialog ref={dialog} aria-labelledby="admin-confirm" onCancel={event => { event.preventDefault(); if (!busy) close(); }}
    className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-xl bg-surface p-6 shadow-xl backdrop:bg-slate-950/45">
    <form className="space-y-4" onSubmit={async event => {
      event.preventDefault();
      if (busy) return;
      setBusy(true);
      setFailure('');
      try {
        await apiRequest('/admin' + action.path, { method: action.method, body: action.reason ? { reason: reason.trim() } : action.body });
        done();
      } catch (error) { setFailure(errorMessage(error)); setBusy(false); }
    }}>
      <h2 id="admin-confirm" className="text-xl font-semibold">{action.title}?</h2>
      <p className="break-words">{action.detail}</p>
      {action.reason && <label className="block">Reason for rejection<textarea className="auth-input mt-1 py-2" required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label>}
      {failure && <Feedback tone="error">{failure}</Feedback>}
      <div className="flex flex-wrap justify-end gap-2"><button type="button" className="secondary-button" disabled={busy} onClick={close}>Cancel</button>
        <button className="primary-button" disabled={busy || (action.reason && !reason.trim())}>{busy ? 'Saving…' : action.title}</button></div>
    </form>
  </dialog>;
}
