import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { scanTicket, type ScanResult } from '../api/checkin';
import { Feedback } from '../components/Feedback';
import { useEvent } from '../hooks/useEvent';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../lib/auth-forms';

function Camera({ onScan, onFailure }: { onScan: (value: string) => void; onFailure: () => void }) {
  const id = useId();
  useEffect(() => {
    let active = true;
    const started = import('html5-qrcode').then(async ({ Html5Qrcode, Html5QrcodeSupportedFormats }) => {
      if (!active) return;
      const reader = new Html5Qrcode(id, { formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE], verbose: false });
      await reader.start({ facingMode: 'environment' }, { fps: 10 }, text => { if (active) onScan(text); }, undefined);
      return reader;
    });
    void started.catch(() => { if (active) onFailure(); });
    return () => {
      active = false;
      void started.then(reader => reader?.stop()).catch(() => {});
    };
  }, [id, onScan, onFailure]);
  return <div id={id} className="overflow-hidden rounded-xl" />;
}

const labels = {
  SUCCESS: 'Success', ALREADY_USED: 'Already used', INVALID: 'Invalid ticket',
  EXPIRED: 'Expired ticket', WRONG_EVENT: 'Wrong event', NOT_CONFIRMED: 'Registration not confirmed',
};

function EventScanner({ id, title }: { id: string; title: string }) {
  const [token, setToken] = useState('');
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanResult>();
  const [error, setError] = useState('');
  const locked = useRef(false);

  const submit = useCallback(async (value: string) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setCamera(false);
    setToken('');
    setError('');
    try {
      setResult(await scanTicket(id, value));
    } catch (failure) {
      setError(errorMessage(failure));
      locked.current = false;
    } finally {
      setBusy(false);
    }
  }, [id]);

  const cameraFailed = useCallback(() => {
    setCamera(false);
    setError('Camera unavailable. Allow camera access or paste the ticket token below.');
  }, []);

  if (result) {
    const success = result.result === 'SUCCESS';
    const used = result.result === 'ALREADY_USED';
    return <main className={`fixed inset-0 z-50 grid place-content-center gap-4 overflow-auto p-6 text-center ${success
      ? 'bg-success text-black' : used ? 'bg-accent text-text' : 'bg-danger text-white'}`}>
      <div role="status">
        <span aria-hidden="true" className="text-7xl">{success ? '✓' : used ? '⚠' : '×'}</span>
        <h1 className="text-3xl font-semibold">{labels[result.result]}</h1>
        {result.result === 'SUCCESS' && <p className="mt-3 break-words text-xl">{result.studentName}</p>}
      </div>
      <button autoFocus className="secondary-button" onClick={() => { locked.current = false; setResult(undefined); }}>Scan next ticket</button>
    </main>;
  }

  return <main className="mx-auto max-w-lg space-y-4 px-4 py-6">
    <Link className="auth-link" to={`/events/${id}`}>← Event details</Link>
    <h1 className="text-2xl font-semibold">Scan tickets</h1><p className="break-words">{title}</p>
    {error && <Feedback tone="error">{error}</Feedback>}
    <button className="secondary-button" disabled={busy} onClick={() => { setError(''); setCamera(!camera); }}>
      {camera ? 'Stop camera' : 'Start camera'}</button>
    {camera && <Camera onScan={submit} onFailure={cameraFailed} />}
    <form className="space-y-2" onSubmit={e => { e.preventDefault(); void submit(token.trim()); }}>
      <label className="block font-semibold" htmlFor="token">Paste ticket token</label>
      <textarea id="token" className="auth-input py-2" autoComplete="off" spellCheck={false}
        value={token} onChange={e => setToken(e.target.value)} />
      <button className="primary-button" disabled={busy || !token.trim()}>{busy ? 'Checking…' : 'Check in'}</button>
    </form>
  </main>;
}

export function Scanner() {
  const { id } = useParams();
  const state = useEvent(id);
  const { user } = useAuth();
  if (!state) return <Feedback tone="info">Loading scanner…</Feedback>;
  if (!state.event || (user?.role !== 'ADMIN' && user?.id !== state.event.organizerId)) {
    return <Feedback tone="error">{state.error ?? 'Only the event organizer or an admin can scan tickets.'}</Feedback>;
  }
  return <EventScanner key={state.event.id} id={state.event.id} title={state.event.title} />;
}
