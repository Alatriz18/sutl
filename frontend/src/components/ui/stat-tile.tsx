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
  good: 'bg-[#0ca30c]/10 text-[#0ca30c]',
  warning: 'bg-[#fab219]/20 text-[#a86a00]',
  critical: 'bg-[#d03b3b]/10 text-[#d03b3b]',
};

export function StatTile({ label, value, icon: Icon, accent = 'navy', hint }: StatTileProps) {
  return (
    <div className="rounded-lg border border-navy/10 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-navy/60">{label}</p>
        <span className={cn('rounded-md p-1.5', accentStyles[accent])}>
          <Icon size={16} />
        </span>
      </div>
      <p className="mt-2 text-3xl font-bold text-navy">{value}</p>
      {hint && <p className="mt-1 text-xs text-navy/40">{hint}</p>}
    </div>
  );
}
