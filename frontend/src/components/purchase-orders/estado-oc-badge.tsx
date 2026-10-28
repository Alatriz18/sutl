import { cn } from '@/lib/utils';
import { ESTADO_OC_LABELS, ESTADO_OC_STYLES } from '@/lib/purchase-orders';
import { EstadoOrdenCompra } from '@/types';

export function EstadoOcBadge({ estado }: { estado: EstadoOrdenCompra }) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium',
        ESTADO_OC_STYLES[estado],
      )}
    >
      {ESTADO_OC_LABELS[estado]}
    </span>
  );
}
