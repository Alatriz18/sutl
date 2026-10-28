'use client';

import { useState } from 'react';
import { BadgeDollarSign, Briefcase, Cog, ShoppingCart, Truck, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const ROLES: { key: string; label: string; icon: LucideIcon; promesa: string; prueba: string[] }[] = [
  {
    key: 'gerencia',
    label: 'Gerencia',
    icon: Briefcase,
    promesa: 'Una vista única del riesgo de abastecimiento de toda la empresa.',
    prueba: ['Dashboard de riesgo', 'OTIF', 'Stock crítico', 'Excepciones abiertas'],
  },
  {
    key: 'compras',
    label: 'Compras',
    icon: ShoppingCart,
    promesa: 'Menos persecución manual de proveedores y mejor seguimiento de compromisos.',
    prueba: ['Horas ahorradas', 'Confirmaciones recibidas', 'Aging de OC'],
  },
  {
    key: 'logistica',
    label: 'Logística',
    icon: Truck,
    promesa: 'Control multioperador sin tener que cambiar de proveedor logístico.',
    prueba: ['Hitos normalizados', 'ETA confiable', 'Excepciones y SLA'],
  },
  {
    key: 'produccion',
    label: 'Producción',
    icon: Cog,
    promesa: 'Anticipación de los materiales en riesgo antes de que paren la línea.',
    prueba: ['Días de cobertura', 'Alertas de stockout'],
  },
  {
    key: 'finanzas',
    label: 'Finanzas',
    icon: BadgeDollarSign,
    promesa: 'Menos urgencias y mejor uso del capital de trabajo.',
    prueba: ['Fletes premium evitados', 'Inventario', 'Costos evitados', 'Variabilidad'],
  },
];

export function ValueTabs() {
  const [active, setActive] = useState(ROLES[0].key);
  const role = ROLES.find((r) => r.key === active) ?? ROLES[0];

  return (
    <div className="overflow-hidden rounded-2xl border border-navy/10 bg-white shadow-xl shadow-navy/5">
      <div role="tablist" aria-label="Propuesta de valor por área" className="flex overflow-x-auto border-b border-navy/10 bg-slate-50/80">
        {ROLES.map((r) => (
          <button
            key={r.key}
            role="tab"
            type="button"
            aria-selected={r.key === active}
            onClick={() => setActive(r.key)}
            className={cn(
              'flex shrink-0 items-center gap-2 border-b-2 px-5 py-4 text-sm font-semibold transition-colors',
              r.key === active ? 'border-sky bg-white text-navy' : 'border-transparent text-navy/50 hover:text-navy',
            )}
          >
            <r.icon size={16} />
            {r.label}
          </button>
        ))}
      </div>
      <div key={role.key} role="tabpanel" className="grid grid-cols-1 gap-8 p-6 motion-safe:animate-fade-up sm:p-10 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-navy/45">SUTL promete</p>
          <p className="mt-2 text-2xl font-bold leading-snug text-navy">{role.promesa}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-navy/45">Cómo se mide</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {role.prueba.map((p) => (
              <li key={p} className="rounded-full bg-sky/10 px-3.5 py-1.5 text-sm font-medium text-navy">
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
