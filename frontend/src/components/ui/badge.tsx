import { cn } from '@/lib/utils';
import { EstadoEnvio } from '@/types';

const estadoStyles: Record<EstadoEnvio, string> = {
  creado: 'bg-slate-100 text-slate-700',
  en_transito: 'bg-sky/10 text-sky',
  en_aduana: 'bg-gold/10 text-gold',
  entregado: 'bg-emerald-100 text-emerald-700',
  incidencia: 'bg-red-100 text-red-700',
};

const estadoLabels: Record<EstadoEnvio, string> = {
  creado: 'Creado',
  en_transito: 'En tránsito',
  en_aduana: 'En aduana',
  entregado: 'Entregado',
  incidencia: 'Incidencia',
};

export function EstadoBadge({ estado }: { estado: EstadoEnvio }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        estadoStyles[estado],
      )}
    >
      {estadoLabels[estado]}
    </span>
  );
}
