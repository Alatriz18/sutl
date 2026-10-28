'use client';

import { useId, useState } from 'react';
import { cn } from '@/lib/utils';

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  const id = useId();
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm text-white/70">
          {label}
        </label>
        <span className="text-sm font-semibold tabular-nums text-white">
          {value.toLocaleString('es-EC')} {unit}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-sky"
      />
    </div>
  );
}

const LEVELS = {
  rojo: {
    label: 'Riesgo alto',
    dot: 'bg-red-400',
    badge: 'border-red-400/40 bg-red-400/10 text-red-200',
    bar: 'from-red-500 to-red-400',
  },
  ambar: {
    label: 'Margen ajustado',
    dot: 'bg-gold',
    badge: 'border-gold/40 bg-gold/10 text-amber-100',
    bar: 'from-gold to-amber-300',
  },
  verde: {
    label: 'Cobertura sana',
    dot: 'bg-emerald-400',
    badge: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100',
    bar: 'from-emerald-500 to-emerald-300',
  },
} as const;

const fmt = (n: number) => n.toLocaleString('es-EC', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function RiskSimulator() {
  const [inventario, setInventario] = useState(1800);
  const [consumo, setConsumo] = useState(150);
  const [eta, setEta] = useState(14);
  const [variabilidad, setVariabilidad] = useState(4);

  const cobertura = inventario / consumo;
  const peorLlegada = eta + variabilidad;
  const gap = cobertura - peorLlegada;
  const nivel: keyof typeof LEVELS = gap < 0 ? 'rojo' : gap < 5 ? 'ambar' : 'verde';
  const L = LEVELS[nivel];

  const escala = Math.max(cobertura, peorLlegada) * 1.15;
  const pct = (d: number) => `${Math.min((d / escala) * 100, 100)}%`;

  const accion =
    nivel === 'rojo'
      ? `Quiebre de stock proyectado ${fmt(Math.abs(gap))} días antes del peor escenario de llegada. Acción: acelerar despacho, evaluar cambio a modo aéreo o redistribuir inventario entre plantas.`
      : nivel === 'ambar'
        ? `Solo ${fmt(gap)} días de holgura. Acción: el analista confirma fecha con proveedor y forwarder hoy y deja la OC en vigilancia diaria.`
        : `Holgura de ${fmt(gap)} días frente al peor escenario. Acción: monitoreo continuo, sin intervención.`;

  return (
    <div className="grid grid-cols-1 gap-8 rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur sm:p-8 lg:grid-cols-5">
      <div className="space-y-5 lg:col-span-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-sky">Pruébalo · SKU de ejemplo</p>
        <Slider label="Inventario utilizable" value={inventario} min={200} max={5000} step={100} unit="u" onChange={setInventario} />
        <Slider label="Consumo diario esperado" value={consumo} min={20} max={500} step={10} unit="u/día" onChange={setConsumo} />
        <Slider label="ETA de la reposición" value={eta} min={1} max={60} unit="días" onChange={setEta} />
        <Slider label="Variabilidad del lead time" value={variabilidad} min={0} max={20} unit="días" onChange={setVariabilidad} />
      </div>

      <div className="flex flex-col justify-between gap-6 lg:col-span-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-[11px] uppercase tracking-wide text-white/45">Días de cobertura</p>
            <p className="mt-1 text-xl font-bold sm:text-2xl tabular-nums text-white">{fmt(cobertura)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-[11px] uppercase tracking-wide text-white/45">Llegada peor caso</p>
            <p className="mt-1 text-xl font-bold sm:text-2xl tabular-nums text-white">{peorLlegada} d</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-[11px] uppercase tracking-wide text-white/45">Gap</p>
            <p className={cn('mt-1 text-xl font-bold sm:text-2xl tabular-nums', gap < 0 ? 'text-red-300' : 'text-white')}>
              {gap > 0 ? '+' : ''}
              {fmt(gap)} d
            </p>
          </div>
        </div>

        <div>
          <div className="relative h-14 rounded-lg bg-black/25">
            <div
              className={cn('absolute inset-y-3 left-0 rounded-r-md bg-gradient-to-r transition-all duration-500', L.bar)}
              style={{ width: pct(cobertura) }}
            />
            <div
              className="absolute inset-y-1 rounded-md border border-dashed border-white/40 bg-white/5 transition-all duration-500"
              style={{ left: pct(eta), width: `calc(${pct(peorLlegada)} - ${pct(eta)})` }}
            />
            <div className="absolute inset-y-0 w-0.5 bg-white transition-all duration-500" style={{ left: pct(eta) }} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-white/55">
            <span className="flex items-center gap-1.5">
              <span className={cn('h-2 w-4 rounded-sm bg-gradient-to-r', L.bar)} /> Stock disponible
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-0.5 bg-white" /> ETA
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-4 rounded-sm border border-dashed border-white/50" /> Ventana de variabilidad
            </span>
          </div>
        </div>

        <div className={cn('rounded-xl border p-4', L.badge)} aria-live="polite">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <span className={cn('h-2.5 w-2.5 rounded-full', L.dot)} />
            {L.label}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed opacity-90">{accion}</p>
        </div>
      </div>
    </div>
  );
}
