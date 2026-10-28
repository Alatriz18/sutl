'use client';

import { useState } from 'react';
import { Anchor, Building2, Factory, Landmark, Warehouse, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type Actor = {
  key: string;
  label: string;
  icon: LucideIcon;
  x: number;
  y: number;
  responsable: string;
  sutl: string;
};

const ACTORS: Actor[] = [
  {
    key: 'compras',
    label: 'Cliente / Compras',
    icon: Building2,
    x: 50,
    y: 12,
    responsable: 'Decisiones comerciales, aprobación de compras, políticas y elección de proveedores.',
    sutl: 'Prioriza, alerta, consolida la información y facilita cada decisión con evidencia.',
  },
  {
    key: 'proveedor',
    label: 'Proveedor',
    icon: Factory,
    x: 86,
    y: 38,
    responsable: 'Producción, disponibilidad del material y despacho.',
    sutl: 'Solicita confirmaciones, monitorea compromisos de fecha y escala cuando se incumplen.',
  },
  {
    key: 'forwarder',
    label: 'Forwarder / transportista',
    icon: Anchor,
    x: 72,
    y: 81,
    responsable: 'Ejecución física del movimiento: marítimo, aéreo o terrestre.',
    sutl: 'Integra hitos, compara ETA contra el compromiso y gestiona cada excepción.',
  },
  {
    key: 'aduana',
    label: 'Agente de aduana',
    icon: Landmark,
    x: 28,
    y: 81,
    responsable: 'Trámite aduanero y nacionalización.',
    sutl: 'Da visibilidad del estado del trámite y de los documentos pendientes.',
  },
  {
    key: 'bodega',
    label: 'Bodega',
    icon: Warehouse,
    x: 14,
    y: 38,
    responsable: 'Recepción, almacenamiento y movimientos físicos.',
    sutl: 'Conecta la recepción con la OC, el tránsito y el inventario disponible.',
  },
];

export function OrchestrationHub() {
  const [active, setActive] = useState(ACTORS[0].key);
  const actor = ACTORS.find((a) => a.key === active) ?? ACTORS[0];

  return (
    <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
      <div className="relative mx-auto aspect-square w-full max-w-md">
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
          <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(13,32,64,0.08)" strokeWidth="0.4" />
          {ACTORS.map((a) => (
            <line
              key={a.key}
              x1="50"
              y1="50"
              x2={a.x}
              y2={a.y}
              stroke={a.key === active ? '#2E86AB' : 'rgba(13,32,64,0.15)'}
              strokeWidth={a.key === active ? 0.8 : 0.4}
              strokeDasharray="2 2"
              className={a.key === active ? 'motion-safe:animate-flow' : undefined}
            />
          ))}
        </svg>

        <div className="absolute left-1/2 top-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-navy text-white shadow-xl shadow-navy/30 ring-8 ring-sky/10 sm:h-28 sm:w-28">
          <span className="text-lg font-extrabold tracking-tight">SUTL</span>
          <span className="text-[9px] uppercase tracking-widest text-white/60">Control Tower</span>
        </div>

        {ACTORS.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => setActive(a.key)}
            aria-pressed={a.key === active}
            className={cn(
              'absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5 rounded-xl px-2 py-1.5 text-center transition-all',
              a.key === active ? 'scale-105' : 'opacity-80 hover:opacity-100',
            )}
            style={{ left: `${a.x}%`, top: `${a.y}%` }}
          >
            <span
              className={cn(
                'flex h-11 w-11 items-center justify-center rounded-full border shadow-sm transition-colors sm:h-12 sm:w-12',
                a.key === active ? 'border-sky bg-sky text-white shadow-sky/30' : 'border-navy/10 bg-white text-navy',
              )}
            >
              <a.icon size={19} />
            </span>
            <span className="max-w-[92px] text-[11px] font-semibold leading-tight text-navy sm:text-xs">{a.label}</span>
          </button>
        ))}
      </div>

      <div key={actor.key} className="motion-safe:animate-fade-up">
        <p className="text-sm font-semibold uppercase tracking-wide text-sky">{actor.label}</p>
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-navy/10 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-navy/45">Sigue siendo responsable de</p>
            <p className="mt-1.5 text-navy/80">{actor.responsable}</p>
          </div>
          <div className="rounded-xl border border-sky/30 bg-sky/5 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky">SUTL hace</p>
            <p className="mt-1.5 font-medium text-navy">{actor.sutl}</p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {ACTORS.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => setActive(a.key)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                a.key === active ? 'border-navy bg-navy text-white' : 'border-navy/15 text-navy/60 hover:border-navy/40',
              )}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
