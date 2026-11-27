import { useState } from 'react';
import { Link } from 'react-router';
import { z } from 'zod';
import * as api from '../../api/admin';
import { userRole } from '../../api/auth';
import { EventStatusBadge } from '../../components/EventBadges';
import { useAuth } from '../../context/AuthContext';
import { label, Pager, Resource, Table, type Ask } from './Shared';

export function Dashboard() {
  return <Resource path="/admin/stats" schema={api.stats}>{s => <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    {Object.entries({ Users: s.users, Registrations: s.registrations, 'Check-ins': s.checkIns,
      'Pending events': s.events.PENDING, 'Approved events': s.events.APPROVED, 'Rejected events': s.events.REJECTED,
      'Open items': s.lostFound.OPEN, 'Matched items': s.lostFound.MATCHED }).map(([title, value]) =>
      <div className="rounded-xl border border-border bg-surface p-5 shadow-sm" key={title}>
        <dt className="text-sm text-muted">{title}</dt><dd className="mt-2 text-3xl font-semibold">{value.toLocaleString()}</dd>
      </div>)}
  </dl>}</Resource>;
}

export function EventList({ queue, ask }: { queue: boolean; ask: Ask }) {
  const [page, go] = useState(1);
  const path = '/admin/events?page=' + page + (queue ? '&status=PENDING' : '');
  return <Resource key={path} path={path} schema={api.events}>{data => <>
    <Table headings={['Event', 'Club', 'Status', 'Actions']} empty={!data.rows.length}>{data.rows.map(e =>
      <tr key={e.id}><td><Link className="auth-link" to={'/events/' + e.id}>{e.title}</Link>
        <small>{e.venue} · {new Date(e.startsAt).toLocaleDateString()}</small></td><td>{e.clubName}</td><td><EventStatusBadge status={e.status} /></td>
        <td><div className="flex gap-2">{queue ? <>
          <button className="secondary-button" onClick={() => ask({ title: 'Approve event', detail: e.title, method: 'POST', path: '/events/' + e.id + '/approve' })}>Approve</button>
          <button className="secondary-button" onClick={() => ask({ title: 'Reject event', detail: e.title, reason: true, method: 'POST', path: '/events/' + e.id + '/reject' })}>Reject</button></> :
          <button className="secondary-button" onClick={() => ask({ title: 'Delete event', detail: 'Permanently remove “' + e.title + '” and its registrations.', method: 'DELETE', path: '/events/' + e.id })}>Delete</button>}</div></td></tr>)}</Table>
    <Pager page={page} go={go} more={data.hasMore} /></>}</Resource>;
}

function PostList({ ask }: { ask: Ask }) {
  const [page, go] = useState(1);
  const path = '/lostfound?page=' + page;
  return <Resource key={path} path={path} schema={api.posts}>{data => <>
    <Table headings={['Item', 'Location', 'Status', 'Actions']} empty={!data.posts.length}>{data.posts.map(p =>
      <tr key={p.id}><td>{p.title}<small>{label(p.type)}</small></td><td>{p.location}</td><td>{p.status === 'OPEN' ? '○' : '✓'} {label(p.status)}</td>
        <td><button className="secondary-button" onClick={() => ask({ title: 'Delete item', detail: 'Permanently remove “' + p.title + '”.', path: '/lostfound/' + p.id, method: 'DELETE' })}>Delete</button></td></tr>)}</Table>
    <Pager page={page} go={go} more={data.hasMore} /></>}</Resource>;
}
export function Content({ ask }: { ask: Ask }) {
  const [type, setType] = useState('events');
  return <><label>Content type<select className="auth-input" value={type} onChange={e => setType(e.target.value)}>
    <option value="events">Events</option><option value="posts">Lost and found</option></select></label>
    {type === 'events' ? <EventList queue={false} ask={ask} /> : <PostList ask={ask} />}</>;
}

export function Users({ ask }: { ask: Ask }) {
  const { user } = useAuth();
  const [page, go] = useState(1);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const path = '/admin/users?' + new URLSearchParams({ page: String(page), search });
  return <><form className="admin-filters" onSubmit={e => { e.preventDefault(); go(1); setSearch(input.trim()); }}>
    <label>Name or email<input type="search" maxLength={160} className="auth-input" value={input} onChange={e => setInput(e.target.value)} /></label>
    <button className="secondary-button">Search</button></form>
    <Resource key={path} path={path} schema={api.users}>{data => <>
      <Table headings={['User', 'Role', 'Account status', 'Actions']} empty={!data.rows.length}>{data.rows.map(u =>
        <tr key={u.id}><td>{u.name}<small>{u.email}</small></td><td><select aria-label={'Role for ' + u.name} className="auth-input"
          disabled={u.id === user?.id} value={u.role} onChange={e => ask({ title: 'Change role', detail: 'Change ' + u.email + ' from ' + label(u.role) + ' to ' + label(e.target.value) + '.',
            path: '/users/' + u.id + '/role', method: 'PATCH', body: { role: e.target.value } })}>
          {userRole.options.map(role => <option key={role} value={role}>{label(role)}</option>)}</select></td>
          <td>{u.blockedAt ? '⊘ Blocked' : '✓ Active'}</td><td><button className="secondary-button" disabled={u.id === user?.id} onClick={() => ask({
            title: u.blockedAt ? 'Unblock user' : 'Block user', detail: u.blockedAt ? 'Restore access for ' + u.email + '.' : 'Revoke sessions and block access for ' + u.email + '.',
            path: '/users/' + u.id + (u.blockedAt ? '/unblock' : '/block'), method: 'POST',
          })}>{u.blockedAt ? 'Unblock' : 'Block'}</button></td></tr>)}</Table><Pager page={page} go={go} more={data.hasMore} /></>}</Resource></>;
}

export function AuditLog() {
  const [page, go] = useState(1);
  const [actor, setActor] = useState('');
  const [action, setAction] = useState('');
  const [query, setQuery] = useState('');
  const path = '/admin/audit-log?page=' + page + '&' + query;
  return <><form className="admin-filters" onSubmit={e => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (actor.trim()) params.set('actor', actor.trim());
    if (action) params.set('action', action);
    setQuery(params.toString()); go(1);
  }}>
    <label>Action<select className="auth-input" value={action} onChange={e => setAction(e.target.value)}>
      <option value="">All actions</option>{api.actions.map(a => <option key={a} value={a}>{label(a)}</option>)}</select></label>
    <label>Actor ID<input className="auth-input" placeholder="User UUID" value={actor} onChange={e => setActor(e.target.value)} /></label>
    <button className="secondary-button" disabled={!!actor.trim() && !z.uuid().safeParse(actor.trim()).success}>Apply filters</button></form>
    <Resource key={path} path={path} schema={api.auditLog}>{data => <>
      <Table headings={['Time', 'Action', 'Actor', 'Target', 'Details']} empty={!data.rows.length}>{data.rows.map(row =>
        <tr key={row.id}><td>{new Date(row.createdAt).toLocaleString()}</td><td>{label(row.action)}</td><td>{row.actorName}<small>{row.actorId}</small></td>
          <td>{row.targetType}<small>{row.targetId}</small></td><td>{Object.entries(row.metadata).filter(([,v]) => v != null)
            .map(([k,v]) => <div key={k}>{k} · {String(v)}</div>)}</td></tr>)}</Table><Pager page={page} go={go} more={data.hasMore} /></>}</Resource></>;
}
