import { cn } from './cn';

export type StatusKind = 'available' | 'busy' | 'in-meeting' | 'away' | 'offline';

const colors: Record<StatusKind, string> = {
  available: 'bg-success-500',
  busy: 'bg-danger-500',
  'in-meeting': 'bg-brand-500',
  away: 'bg-amber-400',
  offline: 'bg-ink-300',
};

const labels: Record<StatusKind, string> = {
  available: 'Available',
  busy: 'Busy',
  'in-meeting': 'In a meeting',
  away: 'Away',
  offline: 'Offline',
};

export function StatusDot({ status, className }: { status: StatusKind; className?: string }) {
  return (
    <span
      role="img"
      aria-label={labels[status]}
      title={labels[status]}
      className={cn('inline-block h-2.5 w-2.5 rounded-full ring-2 ring-surface-1', colors[status], className)}
    />
  );
}
