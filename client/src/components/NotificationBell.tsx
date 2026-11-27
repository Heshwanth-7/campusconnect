import { useEffect, useState } from 'react';
import { NavLink } from 'react-router';
import { unreadCount } from '../api/notifications';

export function NotificationBell() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let version = 0;
    let timer: number | undefined;
    const refresh = async () => {
      if (document.hidden) return;
      const current = ++version;
      try {
        const total = await unreadCount();
        if (version === current) setCount(total);
      } catch { /* Keep the last count until the next poll. */ }
    };
    const visibility = () => {
      window.clearInterval(timer);
      version++;
      if (!document.hidden) {
        void refresh();
        timer = window.setInterval(refresh, 30_000);
      }
    };
    visibility();
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('notifications-read', refresh);
    return () => {
      version++;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('notifications-read', refresh);
    };
  }, []);
  return <NavLink to="/notifications" aria-label={`Notifications, ${count} unread`} title="Notifications"
    className={({ isActive }) => `relative grid size-11 shrink-0 place-items-center rounded-xl ${isActive ? 'bg-primary-tint text-primary' : 'hover:bg-background'}`}>
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M5 16c1-2 1.5-3.5 1.5-7a5.5 5.5 0 0 1 11 0c0 3.5.5 5 1.5 7l1 1.5H4zM10 20a2.3 2.3 0 0 0 4 0" />
    </svg>
    {count > 0 && <span aria-hidden="true" className="absolute top-0 right-0 rounded-full bg-accent px-1 text-xs font-semibold text-text">{count > 99 ? '99+' : count}</span>}
  </NavLink>;
}
