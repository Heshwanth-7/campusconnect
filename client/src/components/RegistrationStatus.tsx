import type { RegistrationStatus as Status } from '../api/registrations';

export function RegistrationStatus({ status, position }: { status: Status; position: number | null }) {
  if (status === 'CANCELLED') return <span className="inline-flex gap-1 text-sm"><span aria-hidden="true">×</span>Cancelled</span>;
  if (status === 'CONFIRMED') {
    return <span className="inline-flex gap-1 rounded-xl bg-success/15 px-3 py-2 text-sm font-semibold text-green-900"><span aria-hidden="true">✓</span>You're in</span>;
  }
  return (
    <span className="inline-flex gap-1 rounded-xl bg-warning/15 px-3 py-2 text-sm font-semibold text-amber-900">
      <span aria-hidden="true">◷</span>Waitlisted{position !== null && ` #${position}`}
    </span>
  );
}
