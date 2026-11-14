'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertOctagon, ClipboardList, ListChecks, Siren } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatTile } from '@/components/ui/stat-tile';
import { extractApiError, formatDate } from '@/lib/format';
import { ACCION_RIESGO } from '@/lib/riesgo-labels';
import { ControlTowerResumen, SemaforoRiesgo } from '@/types';

// El color nunca va solo: cada semáforo lleva su texto.
const SEMAFORO: Partial<Record<SemaforoRiesgo, { texto: string; clase: string }>> = {
  rojo: { texto: 'Rojo', clase: 'bg-[#B3362B]/10 text-[#B3362B]' },
  amarillo: { texto: 'Amarillo', clase: 'bg-[#C98A2B]/20 text-[#8A5A12]' },
};

const PRIORIDAD = { alta: 'alta', media: 'media', baja: 'baja' } as const;

function Vacio({ children }: { children: string }) {
  return <p className="mt-3 text-sm text-navy/50">{children}</p>;
}

function VerTodo({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} className="mt-3 inline-block text-sm font-medium text-sky hover:underline">
      {children}
    </Link>
  );
}

// Tablero de la torre de control: lo que requiere atención hoy en la operación.
export function ControlTower() {
  const [datos, setDatos] = useState<ControlTowerResumen | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setError(null);
    api
      .get<ControlTowerResumen>('/control-tower')
      .then((r) => setDatos(r.data))
      .catch((err) => setError(extractApiError(err, 'No se pudo cargar la torre de control.')));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (error) {
    return (
      <section aria-label="Torre de control" className="rounded-lg border border-navy/10 bg-white p-6 text-center">
        <p className="text-navy/70">{error}</p>
        <Button variant="ghost" className="mt-2" onClick={cargar}>Reintentar</Button>
      </section>
    );
  }
  if (!datos) return <Skeleton className="h-64" />;

  const { riesgo, ocsAtrasadas, vencimientos, excepciones, tareas } = datos;

  return (
    <section aria-label="Torre de control">
      <h2 className="text-lg font-semibold text-navy">Torre de control</h2>
      <p className="text-sm text-navy/60">Lo que necesita atención hoy en tu cadena de abastecimiento.</p>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="SKU en rojo" value={riesgo.resumen.rojo} icon={AlertOctagon} accent={riesgo.resumen.rojo > 0 ? 'critical' : 'good'} hint={`${riesgo.resumen.amarillo} en amarillo`} />
        <StatTile label="OC atrasadas" value={ocsAtrasadas.total} icon={ClipboardList} accent={ocsAtrasadas.total > 0 ? 'warning' : 'good'} />
        <StatTile label="Excepciones abiertas" value={excepciones.abiertas} icon={Siren} accent={excepciones.criticas > 0 ? 'critical' : excepciones.abiertas > 0 ? 'warning' : 'good'} hint={`${excepciones.criticas} crítica(s)`} />
        <StatTile label="Tareas vencidas" value={tareas.vencidasEmpresa} icon={ListChecks} accent={tareas.vencidasEmpresa > 0 ? 'warning' : 'good'} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle>SKU en riesgo</CardTitle>
          {riesgo.criticos.length === 0 ? (
            <Vacio>Ningún SKU en rojo ni amarillo.</Vacio>
          ) : (
            <ul className="mt-3 divide-y divide-navy/5">
              {riesgo.criticos.map((c) => {
                const s = SEMAFORO[c.semaforo];
                return (
                  <li key={c.sku} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-navy">
                        {c.sku}
                        {c.descripcion ? <span className="font-normal text-navy/60"> · {c.descripcion}</span> : null}
                      </p>
                      <p className="text-xs text-navy/60">{c.motivo}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {s && <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.clase}`}>{s.texto}</span>}
                      <span className="text-xs text-navy/70">{ACCION_RIESGO[c.accion]}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <VerTodo href="/dashboard/riesgo">Ver el riesgo completo</VerTodo>
        </Card>

        <Card>
          <CardTitle>Mis tareas de hoy</CardTitle>
          {tareas.misTareasHoy.length === 0 ? (
            <Vacio>No tienes tareas que venzan hoy.</Vacio>
          ) : (
            <ul className="mt-3 divide-y divide-navy/5">
              {tareas.misTareasHoy.map((t) => (
                <li key={t.id} className="py-2">
                  <p className="text-sm font-medium text-navy">{t.titulo}</p>
                  <p className="text-xs text-navy/60">
                    Prioridad {PRIORIDAD[t.prioridad]} · vence {formatDate(t.fechaLimite)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <VerTodo href="/dashboard/tareas">Ir a Tareas</VerTodo>
        </Card>

        <Card>
          <CardTitle>OC atrasadas</CardTitle>
          {ocsAtrasadas.items.length === 0 ? (
            <Vacio>No hay órdenes de compra atrasadas.</Vacio>
          ) : (
            <ul className="mt-3 divide-y divide-navy/5">
              {ocsAtrasadas.items.map((o) => (
                <li key={o.id} className="py-2">
                  <p className="text-sm font-medium text-navy">{o.numero} · {o.proveedor}</p>
                  <p className="text-xs text-navy/60">
                    {o.diasAtraso} día{o.diasAtraso === 1 ? '' : 's'} de atraso (requerida el {formatDate(o.fechaRequerida)})
                  </p>
                </li>
              ))}
            </ul>
          )}
          <VerTodo href="/dashboard/compras">Ver órdenes de compra</VerTodo>
        </Card>

        <Card className="lg:col-span-2">
          <CardTitle>Próximos {datos.ventanaDias} días</CardTitle>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-navy">OC requeridas ({vencimientos.ocs.total})</h3>
              {vencimientos.ocs.items.length === 0 ? (
                <Vacio>Ninguna en esta ventana.</Vacio>
              ) : (
                <ul className="mt-1 divide-y divide-navy/5">
                  {vencimientos.ocs.items.map((o) => (
                    <li key={o.id} className="py-1.5 text-sm text-navy">
                      {o.numero} <span className="text-navy/60">· {o.proveedor} · {formatDate(o.fechaRequerida)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-navy">Embarques por llegar ({vencimientos.embarques.total})</h3>
              {vencimientos.embarques.items.length === 0 ? (
                <Vacio>Ninguno en esta ventana.</Vacio>
              ) : (
                <ul className="mt-1 divide-y divide-navy/5">
                  {vencimientos.embarques.items.map((s) => (
                    <li key={s.id} className="py-1.5 text-sm">
                      <Link href={`/dashboard/shipments/${s.id}`} className="font-medium text-sky hover:underline">{s.codigoGuia}</Link>
                      <span className="text-navy/60"> · {s.destino} · {formatDate(s.fechaEstimadaLlegada)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
