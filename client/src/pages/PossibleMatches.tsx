import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { decide, listMatches, type ItemMatch } from '../api/lostfound';
import { ItemCard } from '../components/ItemCard';
import { Feedback } from '../components/Feedback';
import { errorMessage } from '../lib/auth-forms';

function clues({ category, color, location, text, date }: ItemMatch['breakdown']) {
  return [
    [category ? 'Same category' : 'Different category', category],
    [color ? 'Similar colour' : 'Different colour', color],
    [location === 15 ? 'Same location' : location ? 'Some location words match' : 'Different location', location],
    [text ? 'Shared words in the descriptions' : 'No shared description words', text],
    [date === 10 ? 'Same day' : date ? 'Nearby dates' : 'Dates outside the scoring window', date],
  ] as const;
}

export function PossibleMatches() {
  const [matches, setMatches] = useState<ItemMatch[]>();
  const [version, refresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setError('');
    listMatches().then(data => { if (active) setMatches(data); }).catch(reason => { if (active) setError(errorMessage(reason)); });
    return () => { active = false; };
  }, [version]);
  async function respond(id: string, action: 'confirm' | 'dismiss') {
    setBusy(true);
    setError('');
    try {
      await decide(id, action);
      setMatches(await listMatches());
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-3xl space-y-5 p-4 sm:p-8">
    <Link className="auth-link" to="/lostfound">← Lost &amp; Found</Link>
    <header className="flex items-center justify-between gap-2">
      <h1 className="text-2xl font-semibold">Possible matches</h1>
      <button className="secondary-button" disabled={busy} onClick={() => refresh(version + 1)}>Refresh</button>
    </header>
    {error && <Feedback tone="error">{error}</Feedback>}
    {!matches && !error && <p role="status">Loading matches…</p>}
    {matches?.length === 0 && <p>No possible matches yet. New posts are checked as they arrive.</p>}
    {matches?.map(match => <section key={match.id} className="space-y-3 rounded-xl border border-border bg-surface p-3 shadow-sm sm:p-5">
      <h2 className="text-lg font-semibold">Match score · {match.score}/100</h2>
      <div className="grid grid-cols-2 gap-2"><ItemCard post={match.lostPost} /><ItemCard post={match.foundPost} /></div>
      <ul className="text-sm">{clues(match.breakdown).map(([label, points]) =>
        <li key={label} className="flex justify-between gap-2 border-b border-border py-1"><span>{label}</span><span>{points} pts</span></li>)}</ul>
      {match.contact ? <Feedback tone="success">Both confirmed. Contact {match.contact.name} at <a className="auth-link wrap-anywhere" href={'mailto:' + match.contact.email}>{match.contact.email}</a>.</Feedback> :
        <><p className="text-sm">{match.mySideConfirmed ? '✓ You confirmed. Waiting for the other student.' : 'Both students must confirm to share contact details.'}</p>
          <div className="flex gap-2"><button className="primary-button" disabled={busy || match.mySideConfirmed} onClick={() => void respond(match.id, 'confirm')}>Confirm</button>
            <button className="secondary-button" disabled={busy} onClick={() => void respond(match.id, 'dismiss')}>Not mine</button></div></>}
    </section>)}
  </main>;
}
