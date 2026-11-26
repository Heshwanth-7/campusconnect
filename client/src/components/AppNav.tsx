import { NavLink, Outlet, useLocation } from 'react-router';

const links = [
  { to: '/', label: 'Home', icon: '⌂' },
  { to: '/events', label: 'Events', icon: '▦' },
  { to: '/events/mine', label: 'My Events', icon: '◫' },
  { to: '/registrations/mine', label: 'My Registrations', icon: '✓' },
];

export function AppNav() {
  const { pathname } = useLocation();
  return (
    <div className="min-h-dvh pb-20 md:pb-0">
      <header className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:sticky md:top-0 md:bottom-auto md:border-t-0 md:border-b md:pb-0">
        <nav aria-label="Main navigation" className="mx-auto flex max-w-6xl items-center gap-1 px-3 py-2 md:gap-3 md:px-8">
          <span className="mr-auto hidden font-semibold md:block">CampusConnect</span>
          {links.map(({ to, label, icon }) => (
            <NavLink key={to} to={to} end={to !== '/events' || pathname === '/events/mine'}
              className={({ isActive }) => `flex min-h-11 flex-1 flex-col items-center justify-center rounded-xl px-1 text-center text-xs md:px-3 font-semibold md:flex-none md:flex-row md:gap-2 md:text-sm ${isActive ? 'bg-primary-tint text-primary-hover' : 'text-text hover:bg-background'}`}>
              <span className="text-base leading-tight" aria-hidden="true">{icon}</span>{label}
            </NavLink>
          ))}
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
