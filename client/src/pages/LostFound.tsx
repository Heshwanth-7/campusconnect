import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { listItems, type Post } from '../api/lostfound';
import { ItemCard } from '../components/ItemCard';
import { Feedback } from '../components/Feedback';
import { errorMessage } from '../lib/auth-forms';

export function LostFound() {
  const [params, setParams] = useSearchParams();
  const type = params.get('type') === 'FOUND' ? 'FOUND' : 'LOST';
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{ posts: Post[]; hasMore: boolean }>();
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setResult(undefined);
    setError('');
    listItems(type, page).then(data => { if (active) setResult(data); })
      .catch(reason => { if (active) setError(errorMessage(reason)); });
    return () => { active = false; };
  }, [page, type]);

  return <main className="mx-auto max-w-5xl space-y-5 p-4 sm:p-8">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-3xl font-semibold">Lost &amp; Found</h1>
      <div className="flex flex-wrap gap-2">
        <Link className="secondary-button inline-flex" to="/lostfound/matches">Possible matches</Link>
        <Link className="primary-button inline-flex min-h-11" to={'/lostfound/new?type=' + type}>Report an item</Link>
      </div>
    </header>
    <div className="flex gap-2" aria-label="Post type" role="group">
      {(['LOST', 'FOUND'] as const).map(tab => <button key={tab} aria-pressed={type === tab}
        className={type === tab ? 'primary-button' : 'secondary-button'} onClick={() => { setPage(1); setParams({ type: tab }); }}>
        {tab === 'LOST' ? 'Lost' : 'Found'}</button>)}
    </div>
    {error ? <Feedback tone="error">{error}</Feedback> : !result ? <p role="status">Loading posts…</p> :
      result.posts.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{result.posts.map(post => <ItemCard key={post.id} post={post} />)}</div> :
      <p>No {type.toLowerCase()} posts on this page.</p>}
    {(page > 1 || result?.hasMore) && <nav aria-label="Post pages" className="flex items-center gap-3">
      <button className="secondary-button" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
      <span>Page {page}</span><button className="secondary-button" disabled={!result?.hasMore} onClick={() => setPage(page + 1)}>Next</button>
    </nav>}
  </main>;
}
