import type { ReactNode } from 'react';

const styles = {
  error: { icon: '!', color: 'border-danger/20 bg-danger/5 text-red-800' },
  success: { icon: '✓', color: 'border-success/20 bg-success/5 text-green-800' },
  info: { icon: 'i', color: 'border-info/20 bg-info/5 text-sky-800' },
};

export function Feedback({ tone, children, live = true }: { tone: keyof typeof styles; children: ReactNode; live?: boolean }) {
  const { icon, color } = styles[tone];
  return (
    <div role={live ? (tone === 'error' ? 'alert' : 'status') : undefined} className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${color}`}>
      <span aria-hidden="true" className="mt-px grid size-4 shrink-0 place-items-center rounded-full border text-xs font-semibold leading-none">{icon}</span>
      <div>{children}</div>
    </div>
  );
}
