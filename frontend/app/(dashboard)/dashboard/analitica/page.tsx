'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CheckCircle2, Clock, PackageCheck, Timer } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatTile } from '@/components/ui/stat-tile';
import { CATEGORICAL, CHART_INK, STATUS } from '@/lib/chart-colors';
import { extractApiError, formatDate } from '@/lib/format';
import type { AnaliticaResumen } from '@/types/analitica';

const PERIODOS = [
  { dias: 30, etiqueta: 'Últimos 30 días' },
  { dias: 90, etiqueta: 'Últimos 90 días' },
  { dias: 180, etiqueta: 'Últimos 6 meses' },
  { dias: 365, etiqueta: 'Último año' },
];

const dec = (n: number | null, sufijo = '') => (n === null ? '—' : `${n.toLocaleString('es-EC')}${sufijo}`);
const mesCorto = (m: string) => new Date(`${m}-01T12:00:00`).toLocaleDateString('es-EC', { month: 'short' });
// Verde si cumple la meta, ámbar si anda cerca, rojo si queda lejos (el valor siempre va también en texto).
const colorOtif = (v: number | null) => (v === null ? CHART_INK.muted : v >= 90 ? STATUS.good : v >= 70 ? STATUS.warning : STATUS.critical);

export default function AnaliticaPage() {
  const id = useId();
  const [dias, setDias] = useState(90);
  const [datos, setDatos] = useState<AnaliticaResumen | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setError(null);
    setDatos(null);
    const hasta = new Date();
    const desde = new Date(hasta.getTime() - dias * 86_400_000);
    api
      .get<AnaliticaResumen>(`/analytics/resumen?desde=${desde.toISOString()}&hasta=${hasta.toISOString()}`)
      .then((r) => setDatos(r.data))
      .catch((err) => setError(extractApiError(err, 'No se pudo cargar la analítica.')));
  }, [dias]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const proveedores = useMemo(() => datos?.proveedores.filter((p) => p.pctOtif !== null) ?? [], [datos]);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Analítica de abastecimiento</h1>
          <p className="mt-1 text-navy/60">Cómo cumplen tus proveedores: entregas a tiempo y completas, plazos y atrasos.</p>
        </div>
        <div>
          <label htmlFor={`${id}-p`} className="mb-1 block text-sm font-medium text-navy">Periodo</label>
          <select id={`${id}-p`} value={dias} onChange={(e) => setDias(Number(e.target.value))} className="h-10 rounded-md border border-navy/15 bg-white px-3 text-sm text-navy">
            {PERIODOS.map((p) => <option key={p.dias} value={p.dias}>{p.etiqueta}</option>)}
          </select>
        </div>
      </div>

      {error ? (
        <div className="mt-6 rounded-lg border border-navy/10 bg-white p-6 text-center">
          <p className="text-navy/70">{error}</p>
          <Button variant="ghost" className="mt-2" onClick={cargar}>Reintentar</Button>
        </div>
      ) : !datos ? (
        <Skeleton className="mt-6 h-64" />
      ) : (
        <>
          <p className="mt-2 text-xs text-navy/50">
            Órdenes que vencían entre el {formatDate(datos.periodo.desde)} y el {formatDate(datos.periodo.hasta)}: {datos.otif.ocsEvaluadas} evaluadas.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="OTIF" value={dec(datos.otif.pctOtif, ' %')} icon={CheckCircle2} accent={datos.otif.pctOtif === null ? 'navy' : datos.otif.pctOtif >= 90 ? 'good' : datos.otif.pctOtif >= 70 ? 'warning' : 'critical'} hint="A tiempo y completas" />
            <StatTile label="A tiempo" value={dec(datos.otif.pctATiempo, ' %')} icon={Clock} accent="sky" hint={datos.otif.atrasoPromedioDias !== null ? `Atraso promedio: ${datos.otif.atrasoPromedioDias} días` : 'Sin atrasos'} />
            <StatTile label="Completas" value={dec(datos.otif.pctCompleto, ' %')} icon={PackageCheck} accent="sky" hint={datos.otif.fillRatePromedio !== null ? `Se recibió el ${datos.otif.fillRatePromedio} % de lo pedido` : undefined} />
            <StatTile label="Lead time" value={dec(datos.leadTime.promedioDias, ' d')} icon={Timer} accent="navy" hint={datos.leadTime.muestra ? `Mediana ${dec(datos.leadTime.medianaDias)} · P90 ${dec(datos.leadTime.p90Dias)} (${datos.leadTime.muestra} OC)` : 'Sin OC completadas'} />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardTitle>OTIF por proveedor</CardTitle>
              {proveedores.length === 0 ? (
                <p className="mt-3 text-sm text-navy/50">No hay órdenes evaluables en este periodo.</p>
              ) : (
                <>
                  <p className="sr-only">OTIF por proveedor: {proveedores.map((p) => `${p.nombre} ${p.pctOtif} %`).join(', ')}</p>
                  <div aria-hidden="true" className="mt-4" style={{ height: Math.max(160, proveedores.length * 44) }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={proveedores} layout="vertical" margin={{ left: 16 }}>
                        <CartesianGrid horizontal={false} stroke={CHART_INK.gridline} />
                        <XAxis type="number" domain={[0, 100]} unit=" %" tick={{ fill: CHART_INK.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="nombre" width={130} tick={{ fill: CHART_INK.secondary, fontSize: 12 }} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(v) => `${v} %`} contentStyle={{ borderRadius: 8, borderColor: CHART_INK.gridline, fontSize: 13 }} />
                        <Bar dataKey="pctOtif" name="OTIF" radius={[0, 4, 4, 0]} barSize={20}>
                          {proveedores.map((p) => <Cell key={p.proveedorId} fill={colorOtif(p.pctOtif)} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </Card>

            <Card>
              <CardTitle>Tendencia del OTIF</CardTitle>
              <p className="sr-only">OTIF mensual: {datos.tendencia.map((t) => `${t.mes} ${t.pctOtif ?? 'sin datos'}`).join(', ')}</p>
              <div aria-hidden="true" className="mt-4 h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={datos.tendencia.map((t) => ({ mes: mesCorto(t.mes), otif: t.pctOtif }))}>
                    <CartesianGrid vertical={false} stroke={CHART_INK.gridline} />
                    <XAxis dataKey="mes" tick={{ fill: CHART_INK.muted, fontSize: 12 }} axisLine={{ stroke: CHART_INK.baseline }} tickLine={false} />
                    <YAxis domain={[0, 100]} unit=" %" tick={{ fill: CHART_INK.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v) => `${v} %`} contentStyle={{ borderRadius: 8, borderColor: CHART_INK.gridline, fontSize: 13 }} />
                    <Line type="monotone" dataKey="otif" name="OTIF" stroke={CATEGORICAL[0]} strokeWidth={2} dot={{ r: 4, fill: CATEGORICAL[0] }} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <CardTitle>Atraso de las OC abiertas</CardTitle>
              <p className="mt-1 text-sm text-navy/60">{datos.aging.totalAbiertas} órdenes abiertas, según los días pasados de su fecha requerida.</p>
              <ul className="mt-3 space-y-2">
                {datos.aging.buckets.map((b) => {
                  const max = Math.max(1, ...datos.aging.buckets.map((x) => x.ocs));
                  const critico = b.clave === 'mas_30' || b.clave === '16_30';
                  return (
                    <li key={b.clave} className="text-sm">
                      <div className="flex justify-between"><span className="text-navy">{b.etiqueta}</span><span className="font-semibold tabular-nums text-navy">{b.ocs}</span></div>
                      <div className="mt-1 h-2 rounded-full bg-navy/5" aria-hidden="true">
                        <div className="h-2 rounded-full" style={{ width: `${(b.ocs / max) * 100}%`, background: b.clave === 'al_dia' ? STATUS.good : critico ? STATUS.critical : STATUS.warning }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>

            <Card>
              <CardTitle>Compromiso del proveedor y entregas</CardTitle>
              <dl className="mt-3 space-y-2 text-sm">
                {([
                  ['Órdenes con fecha confirmada', dec(datos.cumplimiento.pctConfirmadas, ' %')],
                  ['Despachó en la fecha que prometió', datos.cumplimiento.conPromesaEvaluada ? `${dec(datos.cumplimiento.pctCumplePromesa, ' %')} (${datos.cumplimiento.conPromesaEvaluada} OC)` : '—'],
                  ['Envíos entregados a tiempo', datos.envios.entregados ? `${dec(datos.envios.pctATiempo, ' %')} de ${datos.envios.entregados}` : '—'],
                  ['Retraso promedio de los envíos tardíos', datos.envios.retrasoPromedioDias !== null ? `${datos.envios.retrasoPromedioDias} días` : '—'],
                ] as const).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b border-navy/5 py-1">
                    <dt className="text-navy/60">{k}</dt>
                    <dd className="font-medium text-navy">{v}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          </div>

          <Card className="mt-6">
            <CardTitle>Detalle por proveedor</CardTitle>
            {datos.proveedores.length === 0 ? (
              <p className="mt-3 text-sm text-navy/50">No hay órdenes que vencieran en este periodo.</p>
            ) : (
              <div className="-mx-5 mt-3 overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="border-y border-navy/5 bg-navy/[0.03] text-navy/60">
                    <tr>
                      <th scope="col" className="px-5 py-2 font-medium">Proveedor</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">OC</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">OTIF</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">A tiempo</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Completas</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Lead time</th>
                      <th scope="col" className="px-5 py-2 text-right font-medium">Cumple promesa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.proveedores.map((p) => (
                      <tr key={p.proveedorId} className="border-b border-navy/5 last:border-0">
                        <td className="px-5 py-3 font-medium text-navy">{p.nombre}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{p.ocs}</td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums text-navy">{dec(p.pctOtif, ' %')}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{dec(p.pctATiempo, ' %')}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{dec(p.pctCompleto, ' %')}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{dec(p.leadTimePromedioDias, ' d')}</td>
                        <td className="px-5 py-3 text-right tabular-nums">{dec(p.pctCumplePromesa, ' %')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-xs text-navy/50">
              OTIF = a tiempo y completa. «A tiempo»: quedó completa a más tardar el día requerido. «Lead time»: días entre emitir la orden y completarla. Una orden incompleta con la fecha vencida cuenta como no cumplida.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
