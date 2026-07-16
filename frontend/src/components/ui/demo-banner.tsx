import { Sparkles } from 'lucide-react';

export function DemoBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-start gap-3 rounded-lg border border-gold/30 bg-gold/5 px-4 py-3 text-sm text-navy/70">
      <Sparkles size={16} className="mt-0.5 shrink-0 text-gold" />
      <p>{children}</p>
    </div>
  );
}
