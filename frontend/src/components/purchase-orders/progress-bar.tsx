import { cn } from '@/lib/utils';

export function ProgressBar({ value, className, label }: { value: number; className?: string; label: string }) {
  const pct = Math.round(Math.min(Math.max(value, 0), 1) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-navy/10', className)}
    >
      <div
        className={cn('h-full rounded-full transition-all', pct >= 100 ? 'bg-emerald-500' : 'bg-sky')}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
