import type { CampusEvent, Category } from '../api/events';

export const categoryLabels: Record<Category, string> = {
  MUSIC: 'Music', TECH: 'Tech', SPORTS: 'Sports', CULTURAL: 'Cultural', WORKSHOP: 'Workshop', OTHER: 'Other',
};

const categoryStyle = {
  MUSIC: { icon: '♫', color: 'bg-primary-tint text-primary-hover' },
  TECH: { icon: '⌘', color: 'bg-sky-100 text-sky-900' },
  SPORTS: { icon: '⚽', color: 'bg-green-100 text-green-900' },
  CULTURAL: { icon: '✦', color: 'bg-purple-100 text-purple-900' },
  WORKSHOP: { icon: '⚒', color: 'bg-accent text-text' },
  OTHER: { icon: '•', color: 'bg-slate-100 text-slate-800' },
};

const statusStyle = {
  PENDING: { icon: '◷', label: 'Pending', color: 'bg-warning/15 text-amber-900' },
  APPROVED: { icon: '✓', label: 'Approved', color: 'bg-success/15 text-green-900' },
  REJECTED: { icon: '×', label: 'Rejected', color: 'bg-danger/15 text-red-900' },
};

const badge = 'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold';

export function CategoryBadge({ category }: { category: Category }) {
  const { icon, color } = categoryStyle[category];
  return <span className={`${badge} ${color}`}><span aria-hidden="true">{icon}</span>{categoryLabels[category]}</span>;
}

export function EventStatusBadge({ status }: { status: CampusEvent['status'] }) {
  const { icon, label, color } = statusStyle[status];
  return <span className={`${badge} ${color}`}><span aria-hidden="true">{icon}</span>{label}</span>;
}

export function EventPoster({ event, full = false }: { event: CampusEvent; full?: boolean }) {
  if (!event.posterImagePath) {
    return <div aria-hidden="true" className="grid h-40 w-full place-items-center rounded-xl bg-slate-100 text-4xl text-muted">
      {categoryStyle[event.category].icon}
    </div>;
  }
  return <img src={event.posterImagePath} alt={event.title} loading={full ? 'eager' : 'lazy'}
    className={full ? 'h-auto w-full rounded-xl' : 'h-40 w-full rounded-xl object-cover'} />;
}
