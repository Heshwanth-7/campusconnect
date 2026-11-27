import { useState } from 'react';
import { Link, Navigate, NavLink, useNavigate, useParams } from 'react-router';
import { AuditLog, Content, Dashboard, EventList, Users } from './Sections';
import { Confirmation, Revision, type Action } from './Shared';
import { Feedback } from '../../components/Feedback';

const sections = [
  { slug: '', title: 'Dashboard' }, { slug: 'moderation', title: 'Moderation Queue' },
  { slug: 'users', title: 'Users' }, { slug: 'content', title: 'Content' }, { slug: 'audit-log', title: 'Audit Log' },
];

export function AdminPanel() {
  const { section = '' } = useParams();
  const navigate = useNavigate();
  const [action, ask] = useState<Action | null>(null);
  const [revision, refresh] = useState(0);
  const [notice, setNotice] = useState('');
  const current = sections.find(s => s.slug === section);
  if (!current) return <Navigate to="/admin" replace />;
  const url = (slug: string) => slug ? '/admin/' + slug : '/admin';
  function confirm(next: Action) { setNotice(''); ask(next); }
  return <div className="admin-layout mx-auto grid min-h-dvh max-w-screen-2xl md:grid-cols-[15rem_minmax(0,1fr)]">
    <aside className="border-b border-border bg-surface p-4 md:border-r md:border-b-0 md:p-6">
      <Link className="auth-link inline-flex min-h-11 items-center" to="/">← CampusConnect</Link>
      <p className="my-3 text-xl font-semibold">Admin Panel</p>
      <nav aria-label="Admin sections" className="hidden space-y-1 md:block">{sections.map(s =>
        <NavLink end key={s.slug} to={url(s.slug)} className={({ isActive }) => 'flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold ' +
          (isActive ? 'bg-primary-tint text-primary-hover' : 'hover:bg-background')}>{s.title}</NavLink>)}</nav>
      <select className="auth-input md:hidden" aria-label="Admin section" value={section} onChange={e => void navigate(url(e.target.value))}>
        {sections.map(s => <option key={s.slug} value={s.slug}>{s.title}</option>)}</select>
    </aside>
    <main className="min-w-0 space-y-5 px-4 py-6 md:p-8">
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{current.title}</h1>
      {notice && <Feedback tone="success">{notice}</Feedback>}
      <Revision.Provider value={revision}>
        {section === '' && <Dashboard />}
        {section === 'moderation' && <EventList queue ask={confirm} />}
        {section === 'users' && <Users ask={confirm} />}
        {section === 'content' && <Content ask={confirm} />}
        {section === 'audit-log' && <AuditLog />}
      </Revision.Provider>
    </main>
    {action && <Confirmation action={action} close={() => ask(null)} done={() => {
      setNotice(action.title + ' completed.'); ask(null); refresh(n => n + 1);
    }} />}
  </div>;
}
