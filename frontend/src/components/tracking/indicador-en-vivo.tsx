import type { EstadoEnVivo } from '@/lib/en-vivo';

// Aviso discreto de que el seguimiento se actualiza solo (o de que está reconectando).
export function IndicadorEnVivo({ estado }: { estado: EstadoEnVivo }) {
  if (estado === 'apagado') return null;
  const vivo = estado === 'en_vivo';
  return (
    <span role="status" data-testid="indicador-en-vivo" data-estado={estado} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${vivo ? 'bg-[#E6F4EC] text-[#1A7A4C]' : 'bg-navy/5 text-navy/60'}`}>
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${vivo ? 'bg-[#1A7A4C] motion-safe:animate-pulse' : 'bg-navy/40'}`} />
      {vivo ? 'En vivo' : estado === 'conectando' ? 'Conectando…' : 'Reconectando…'}
    </span>
  );
}
