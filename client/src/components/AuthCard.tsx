import type { ReactNode } from 'react';

export function AuthCard({ title, description, children }: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <main className="auth-screen">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="mb-6 flex items-center gap-2.5 font-semibold">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-xs text-white" aria-hidden="true">CC</span>
          CampusConnect
        </div>
        <h1 id="auth-title" className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>}
        <div className="mt-6">{children}</div>
      </section>
    </main>
  );
}
