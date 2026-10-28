'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const CRITERIA = [
  'Importamos, exportamos o compramos insumos de forma recurrente',
  'Tenemos 50+ SKU críticos o muchas órdenes de compra abiertas a la vez',
  'Trabajamos con 3 o más forwarders, transportistas u operadores',
  'El seguimiento vive en Excel, correo y WhatsApp',
  'Hemos tenido quiebres de stock, urgencias o fletes premium este año',
  'Hay un responsable de supply chain, compras u operaciones que lo patrocinaría',
];

export function IcpCheck() {
  const [checked, setChecked] = useState<boolean[]>(CRITERIA.map(() => false));
  const score = checked.filter(Boolean).length;

  const result =
    score >= 4
      ? { title: 'Encaje alto', text: 'Tu operación tiene el perfil exacto de un piloto SUTL de 12 semanas.', tone: 'text-emerald-300' }
      : score >= 2
        ? { title: 'Encaje probable', text: 'Un diagnóstico de 2 semanas confirmaría dónde está el costo oculto.', tone: 'text-gold' }
        : { title: 'Marca lo que aplica', text: 'El mejor predictor no es el tamaño de la empresa, es la complejidad.', tone: 'text-white/70' };

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
      <ul className="space-y-2.5 lg:col-span-3">
        {CRITERIA.map((c, i) => (
          <li key={c}>
            <button
              type="button"
              role="checkbox"
              aria-checked={checked[i]}
              onClick={() => setChecked((prev) => prev.map((v, j) => (j === i ? !v : v)))}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-sm transition-all',
                checked[i]
                  ? 'border-sky/60 bg-sky/15 text-white'
                  : 'border-white/10 bg-white/[0.03] text-white/70 hover:border-white/25',
              )}
            >
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                  checked[i] ? 'border-sky bg-sky text-white' : 'border-white/30',
                )}
              >
                {checked[i] && <Check size={13} strokeWidth={3} />}
              </span>
              {c}
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-6 lg:col-span-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-white/45">Tu resultado</p>
          <p className="mt-3 text-5xl font-extrabold tabular-nums text-white">
            {score}
            <span className="text-2xl text-white/35">/{CRITERIA.length}</span>
          </p>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky to-emerald-400 transition-all duration-500"
              style={{ width: `${(score / CRITERIA.length) * 100}%` }}
            />
          </div>
          <p className={cn('mt-5 text-lg font-bold', result.tone)} aria-live="polite">
            {result.title}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-white/60">{result.text}</p>
        </div>
        <Link
          href="/login"
          className="mt-8 inline-flex items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-navy transition-transform hover:-translate-y-0.5"
        >
          Ver la plataforma en vivo
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
