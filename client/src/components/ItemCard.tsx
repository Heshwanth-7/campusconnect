import type { Post } from '../api/lostfound';

export function ItemCard({ post }: { post: Post }) {
  const lost = post.type === 'LOST';
  const date = new Date(post.occurredAt).toLocaleDateString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
  return (
    <article className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      {post.imagePath && <img className="aspect-4/3 w-full object-contain bg-background" src={post.imagePath} alt={post.title} />}
      <div className="space-y-2 p-3 wrap-anywhere sm:p-5">
        <span className={'inline-flex items-center gap-1 rounded-xl px-2 py-1 text-xs font-semibold ' + (lost ? 'bg-red-50 text-danger' : 'bg-green-50 text-green-800')}>
          <span aria-hidden="true">{lost ? '🔍' : '✓'}</span>{post.type}
        </span>
        <h2 className="font-semibold">{post.title}</h2>
        <p className="text-sm">{post.description}</p>
        <p className="text-sm text-muted">{post.category.toLowerCase().replace('_', ' ')} · {post.color}</p>
        <p className="text-sm">{post.location} · {date}</p>
        <p className="text-xs font-semibold">{({ OPEN: '○ Open', MATCHED: '✓ Matched', RESOLVED: '✓ Resolved' })[post.status]}</p>
      </div>
    </article>
  );
}
