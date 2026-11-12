'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertOctagon, AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatTile } from '@/components/ui/stat-tile';
import { cn } from '@/lib/utils';
import { extractApiError, formatDate, formatDateTime, formatNumber } from '@/lib/format';
import { useToast } from '@/lib/toast-context';
import { AccionRiesgo, CambioRiesgo, FilaRiesgo, RiesgoResponse, SemaforoRiesgo } from '@/types';

type Filtro = 'atencion' | 'todos' | SemaforoRiesgo;

const FILTROS: { value: Filtro; label: string }[] = [
  { value: 'atencion', label: 'Requieren atención' },
  { value: 'rojo', label: 'Rojo' },
  { value: 'amarillo', label: 'Amarillo' },
  { value: 'verde', label: 'Verde' },
  { value: 'sin_datos', label: 'Sin datos' },
  { value: 'todos', label: 'Todos' },
];

// El color nunca va solo: cada semáforo lleva su texto.
const SEMAFORO: Record<SemaforoRiesgo, { texto: string; clase: string }> = {
  rojo: { texto: 'Rojo', clase: 'bg-[#B3362B]/10 text-[#B3362B]' },
  amarillo: { texto: 'Amarillo', clase: 'bg-[#C98A2B]/20 text-[#8A5A12]' },
  verde: { texto: 'Verde', clase: 'bg-[#1A7A4C]/10 text-[#1A7A4C]' },
  sin_datos: { texto: 'Sin datos', clase: 'bg-navy/10 text-navy/70' },
};

const ACCION: Record<AccionRiesgo, string> = {
  adelantar_proveedor: 'Urgir al proveedor que despache ya',
  partir_envio: 'Partir el embarque y adelantar una parte',
  compra_urgente: 'Comprar ya (compra urgente)',
  confirmar_fecha: 'Confirmar la fecha real de llegada',
  planificar_compra: 'Planificar la compra',
  ninguna: '—',
};

function Reposiciones({ f }: { f: FilaRiesgo }) {
  if (f.reposiciones.length === 0) return <span className="text-navy/40">Nada en camino ni pedido</span>;
  return (
    <ul className="space-y-0.5">
      {f.reposiciones.map((r, i) => (
        <li key={`${r.referencia}-${i}`} className="text-xs text-navy/70">
          <span className="font-medium text-navy">{formatNumber(r.cantidad)}</span>{' '}
          {r.origen === 'embarque' ? `en ${r.referencia}` : `pedido en ${r.referencia}`}
          {' · '}
          {r.fecha ? `llega ${formatDate(r.fecha)}` : 'sin fecha de llegada'}
        </li>
      ))}
    </ul>
  );
}

export default function RiesgoPage() {
  const [data, setData] = useState<RiesgoResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('atencion');
  const [cambios, setCambios] = useState<CambioRiesgo[]>([]);
  const [evaluando, setEvaluando] = useState(false);
  const toast = useToast();

  const cargar = useCallback(() => {
    setError(null);
    api
      .get<RiesgoResponse>('/supply-risk')
      .then((res) => setData(res.data))
      .catch((err) => setError(extractApiError(err, 'No se pudo evaluar el riesgo de abastecimiento.')));
    api
      .get<CambioRiesgo[]>('/supply-risk/cambios')
      .then((res) => setCambios(res.data))
      .catch(() => setCambios([]));
  }, []);

  async function reevaluar() {
    setEvaluando(true);
    try {
      const r = await api.post<{ cambios: CambioRiesgo[] }>('/supply-risk/evaluar');
      toast.success(r.data.cambios.length === 0 ? 'Evaluado: ningún SKU cambió de semáforo.' : `Evaluado: ${r.data.cambios.length} SKU cambiaron de semáforo.`);
      cargar();
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo evaluar el riesgo.'));
    } finally {
      setEvaluando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, [cargar]);

  const visibles = useMemo(() => {
    if (!data) return [];
    return data.filas.filter((f) =>
      filtro === 'todos' ? true : filtro === 'atencion' ? f.semaforo === 'rojo' || f.semaforo === 'amarillo' : f.semaforo === filtro,
    );
  }, [data, filtro]);

  if (error && !data) {
    return (
      <div className="rounded-lg border border-navy/10 bg-white p-6 text-center">
        <p className="text-navy/70">{error}</p>
        <Button variant="ghost" className="mt-2" onClick={cargar}>
          Reintentar
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <Skeleton className="h-8 w-72" />
        <Skeleton className="mt-2 h-4 w-96" />
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="mt-6 h-64" />
      </div>
    );
  }

  const { resumen } = data;

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
      <h1 className="text-2xl font-bold text-navy">Riesgo de abastecimiento</h1>
      <p className="mt-1 text-navy/60">
        Para cada SKU se proyecta cuándo se acaba el stock según su consumo y se compara con lo que llega (embarques en camino con su fecha estimada). Si se acaba antes de que llegue la reposición, está en rojo. SUTL lo evalúa cada hora y deja el historial de cambios abajo.
      </p>
        </div>
        <Button variant="secondary" className="shrink-0" disabled={evaluando} onClick={reevaluar}>
          {evaluando ? 'Evaluando...' : 'Evaluar ahora'}
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="En rojo" value={resumen.rojo} icon={AlertOctagon} accent={resumen.rojo ? 'critical' : 'good'} hint="Se quedan sin stock" />
        <StatTile label="En amarillo" value={resumen.amarillo} icon={AlertTriangle} accent={resumen.amarillo ? 'warning' : 'good'} hint="Cobertura justa o fecha dudosa" />
        <StatTile label="En verde" value={resumen.verde} icon={CheckCircle2} accent="good" hint="Sin quiebres proyectados" />
        <StatTile label="Sin datos" value={resumen.sinDatos} icon={HelpCircle} accent="sky" hint="Faltan parámetros o stock" />
      </div>

      <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Filtrar por semáforo">
        {FILTROS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFiltro(f.value)}
            aria-pressed={filtro === f.value}
            className={cn(
              'rounded-full border px-3 py-1 text-sm',
              filtro === f.value ? 'border-navy bg-navy text-white' : 'border-navy/20 bg-white text-navy hover:bg-navy/5',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="relative mt-4 overflow-x-auto rounded-lg border border-navy/10 bg-white">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Riesgo de abastecimiento por SKU</caption>
          <thead className="bg-navy/5 text-navy">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Estado</th>
              <th scope="col" className="px-4 py-3 font-medium">SKU</th>
              <th scope="col" className="px-4 py-3 font-medium">Stock</th>
              <th scope="col" className="px-4 py-3 font-medium">Se acaba</th>
              <th scope="col" className="px-4 py-3 font-medium">Por qué</th>
              <th scope="col" className="px-4 py-3 font-medium">Qué hacer</th>
              <th scope="col" className="px-4 py-3 font-medium">Lo que viene</th>
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-navy/50">
                  {filtro === 'atencion' ? 'Ningún SKU requiere atención ahora.' : 'No hay SKUs con este estado.'}
                </td>
              </tr>
            )}
            {visibles.map((f) => (
              <tr key={f.sku} className="border-t border-navy/5 align-top">
                <td className="px-4 py-3">
                  <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-semibold', SEMAFORO[f.semaforo].clase)}>
                    {SEMAFORO[f.semaforo].texto}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-navy">{f.sku}</p>
                  {f.descripcion && <p className="text-xs text-navy/50">{f.descripcion}</p>}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {f.stock == null ? '—' : `${formatNumber(f.stock)} ${f.unidad ?? ''}`}
                  {f.diasCobertura != null && <p className="text-xs text-navy/50">{f.diasCobertura} días</p>}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {f.fechaQuiebre && f.semaforo !== 'sin_datos' ? formatDate(f.fechaQuiebre) : '—'}
                  {f.diasSinStock > 0 && <p className="text-xs font-medium text-[#B3362B]">{f.diasSinStock} días sin stock</p>}
                </td>
                <td className="px-4 py-3 text-navy/80">{f.motivo}</td>
                <td className="px-4 py-3 font-medium text-navy">{ACCION[f.accion]}</td>
                <td className="px-4 py-3">
                  <Reposiciones f={f} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="mt-8" aria-labelledby="historial-riesgo">
        <h2 id="historial-riesgo" className="text-lg font-semibold text-navy">
          Historial de cambios
        </h2>
        {cambios.length === 0 ? (
          <p className="mt-2 text-sm text-navy/50">Todavía no hay cambios registrados. Pulsa «Evaluar ahora» para guardar el estado actual de cada SKU.</p>
        ) : (
          <ul className="mt-2 divide-y divide-navy/5 rounded-lg border border-navy/10 bg-white">
            {cambios.slice(0, 20).map((c) => (
              <li key={c.id} className="flex flex-col gap-1 px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span className="text-navy">
                  <span className="font-medium">{c.sku}</span>{' '}
                  {c.desde ? (
                    <>
                      pasó de <span className="font-medium">{SEMAFORO[c.desde].texto}</span> a <span className="font-medium">{SEMAFORO[c.hacia].texto}</span>
                    </>
                  ) : (
                    <>
                      se evaluó por primera vez: <span className="font-medium">{SEMAFORO[c.hacia].texto}</span>
                    </>
                  )}
                  {c.hacia === 'rojo' && c.avisado && <span className="ml-2 text-xs text-navy/50">· se avisó por correo</span>}
                </span>
                <span className="text-xs text-navy/50">{formatDateTime(c.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-6 text-xs text-navy/50">
        Una OC que todavía no viaja no cuenta como llegada (no tiene fecha confiable) y una fecha estimada ya vencida tampoco. Los parámetros de cada SKU se editan en{' '}
        <Link href="/dashboard/cobertura" className="underline">
          Cobertura de inventario
        </Link>
        .
      </p>
    </div>
  );
}
