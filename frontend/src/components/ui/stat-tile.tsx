import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatTileProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: 'navy' | 'sky' | 'good' | 'warning' | 'critical';
  hint?: string;
}

const accentStyles: Record<NonNullable<StatTileProps['accent']>, string> = {
  navy: 'bg-navy/10 text-navy',
  sky: 'bg-sky/10 text-sky',
  good: 'bg-[#1A7A4C]/10 text-[#1A7A4C]',
  warning: 'bg-[#C98A2B]/20 text-[#8A5A12]',
  critical: 'bg-[#B3362B]/10 text-[#B3362B]',
};

const barStyles: Record<NonNullable<StatTileProps['accent']>, string> = {
  navy: 'bg-navy',
  sky: 'bg-sky',
  good: 'bg-[#1A7A4C]',
  warning: 'bg-[#C98A2B]',
  critical: 'bg-[#B3362B]',
};

export function StatTile({ label, value, icon: Icon, accent = 'navy', hint }: StatTileProps) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-navy/[0.07] bg-white p-5 shadow-[0_1px_2px_rgba(13,32,64,0.04),0_8px_24px_-12px_rgba(13,32,64,0.08)] transition-shadow hover:shadow-[0_1px_2px_rgba(13,32,64,0.06),0_12px_28px_-10px_rgba(13,32,64,0.14)]">
      <span className={cn('absolute inset-x-0 top-0 h-0.5', barStyles[accent])} />
      <div className="flex items-center justify-between">
        <p className="text-sm text-navy/60">{label}</p>
        <span className={cn('rounded-md p-1.5 transition-transform group-hover:scale-110', accentStyles[accent])}>
          <Icon size={16} />
        </span>
      </div>
      <p className="mt-2 text-3xl font-bold tracking-tight text-navy">{value}</p>
      {hint && <p className="mt-1 text-xs text-navy/40">{hint}</p>}
    </div>
  );
}
