'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, FileWarning } from 'lucide-react';
import { cn } from '@/lib/utils';

const KPIS = [
  { label: 'OCs abiertas', value: '142', tone: 'text-white' },
  { label: 'En tránsito', value: '38', tone: 'text-sky' },
  { label: 'Excepciones', value: '7', tone: 'text-gold' },
  { label: 'OTIF', value: '94%', tone: 'text-emerald-400' },
];

const NODES = [
  { label: 'Proveedor', x: 30, status: 'ok' },
  { label: 'Forwarder', x: 105, status: 'ok' },
  { label: 'Aduana', x: 180, status: 'warn' },
  { label: 'Bodega', x: 255, status: 'ok' },
  { label: 'Planta', x: 330, status: 'risk' },
] as const;

const FEED = [
  {
    icon: AlertTriangle,
    tone: 'red',
    title: 'Resina PET · cobertura 6 días',
    detail: 'ETA del embarque en 11 días → acelerar despacho',
  },
  {
    icon: Clock,
    tone: 'amber',
    title: 'BL MSCU7731 sin hito hace 72 h',
    detail: 'Analista solicita confirmación al forwarder',
  },
  {
    icon: FileWarning,
    tone: 'amber',
    title: 'Certificado fitosanitario vence en 3 días',
    detail: 'Checklist documental de OC-4471 incompleto',
  },
  {
    icon: CheckCircle2,
    tone: 'green',
    title: 'Proveedor confirmó fecha de despacho',
    detail: 'OC-4398 · riesgo bajó de alto a medio',
  },
] as const;

const TONE: Record<string, string> = {
  red: 'bg-red-500/15 text-red-300',
  amber: 'bg-gold/15 text-gold',
  green: 'bg-emerald-400/15 text-emerald-300',
};

const NODE_COLOR: Record<string, string> = {
  ok: '#34d399',
  warn: '#B38A3C',
  risk: '#f87171',
};

export function ControlTowerMock() {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => setOffset((o) => (o + 1) % FEED.length), 2800);
    return () => clearInterval(id);
  }, []);

  const visible = [0, 1, 2].map((i) => FEED[(offset + i) % FEED.length]);

  return (
    <div className="relative w-full max-w-lg">
      <div className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-sky/20 blur-3xl motion-safe:animate-glow" aria-hidden />
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0a1a33]/80 shadow-2xl shadow-black/50 backdrop-blur">
        <div className="flex items-center gap-1.5 border-b border-white/10 bg-white/[0.03] px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          <span className="ml-3 text-xs text-white/40">app.sutl.io/control-tower</span>
          <span className="ml-auto flex items-center gap-1.5 text-[10px] font-medium text-emerald-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            En vivo
          </span>
        </div>

        <div className="space-y-3 p-4 sm:p-5">
          <div className="grid grid-cols-4 gap-2">
            {KPIS.map((k) => (
              <div key={k.label} className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2">
                <p className="truncate text-[9px] uppercase tracking-wide text-white/40 sm:text-[10px]">{k.label}</p>
                <p className={cn('text-sm font-bold sm:text-base', k.tone)}>{k.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 pb-2 pt-3">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-white/50">
              Cadena orquestada · OC-4471
            </p>
            <svg viewBox="0 0 360 64" className="h-auto w-full" role="img" aria-label="Flujo de la orden de compra entre actores">
              {NODES.slice(0, -1).map((n, i) => (
                <line
                  key={n.label}
                  x1={n.x + 9}
                  y1={24}
                  x2={NODES[i + 1].x - 9}
                  y2={24}
                  stroke="rgba(46,134,171,0.7)"
                  strokeWidth={2}
                  strokeDasharray="6 6"
                  className="motion-safe:animate-flow"
                />
              ))}
              {NODES.map((n) => (
                <g key={n.label}>
                  <circle cx={n.x} cy={24} r={13} fill={NODE_COLOR[n.status]} opacity={0.15} />
                  <circle cx={n.x} cy={24} r={6} fill={NODE_COLOR[n.status]} />
                  <text x={n.x} y={54} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.6)">
                    {n.label}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-white/70">Centro de excepciones</p>
              <span className="text-[10px] text-white/40">Analista: M. Torres</span>
            </div>
            <ul className="space-y-2">
              {visible.map((item, i) => (
                <li
                  key={`${offset}-${i}`}
                  className="flex items-start gap-2.5 rounded-md bg-white/[0.03] px-2.5 py-2 motion-safe:animate-slide-in"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <span className={cn('mt-0.5 rounded-full p-1', TONE[item.tone])}>
                    <item.icon size={12} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-white">{item.title}</p>
                    <p className="truncate text-[10px] text-white/45">{item.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
