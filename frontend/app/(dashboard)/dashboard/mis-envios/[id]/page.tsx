'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EstadoBadge } from '@/components/ui/badge';
import { Conversacion } from '@/components/portal/conversacion';
import { extractApiError, formatDate, formatDateTime, formatKg } from '@/lib/format';
import type { EnvioDeCliente, EventoDeCliente } from '@/types/portal';

const MODO = { maritimo: 'Marítimo', aereo: 'Aéreo', terrestre: 'Terrestre' } as const;
const TIPO = { importacion: 'Importación', exportacion: 'Exportación' } as const;

// Detalle de solo lectura de un envío del cliente final, con su seguimiento y la conversación con la empresa.
export default function MiEnvioPage() {
  const { id } = useParams<{ id: string }>();
  const [envio, setEnvio] = useState<EnvioDeCliente | null>(null);
  const [eventos, setEventos] = useState<EventoDeCliente[]>([]);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setError(null);
    Promise.all([api.get<EnvioDeCliente>(`/shipments/${id}`), api.get<EventoDeCliente[]>(`/tracking-events/shipment/${id}`)])
      .then(([e, ev]) => {
        setEnvio(e.data);
        setEventos(ev.data);
      })
      .catch((err) => setError(extractApiError(err, 'No se pudo cargar el envío.')));
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (error) {
    return (
      <div className="rounded-lg border border-navy/10 bg-white p-6 text-center">
        <p className="text-navy/70">{error}</p>
        <Button variant="ghost" className="mt-2" onClick={cargar}>Reintentar</Button>
        <Link href="/dashboard/mis-envios" className="mt-2 block text-sm text-sky hover:underline">Volver a mis envíos</Link>
      </div>
    );
  }
  if (!envio) return <Skeleton className="h-64" />;

  return (
    <div>
      <Link href="/dashboard/mis-envios" className="text-sm text-sky hover:underline">← Mis envíos</Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-navy">{envio.codigoGuia}</h1>
        <EstadoBadge estado={envio.estado} />
      </div>
      <p className="text-navy/60">{TIPO[envio.tipo]} · {MODO[envio.modo]} · {envio.origen} → {envio.destino}</p>

      <Card className="mt-6">
        <CardTitle>Datos del envío</CardTitle>
        <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          {([
            ['Transportista', envio.carrier?.nombre ?? '—'],
            ['Remitente', envio.remitenteNombre],
            ['Destinatario', envio.destinatarioNombre],
            ['Referencia (BL/AWB)', envio.referenciaDocumento ?? '—'],
            ['Salida estimada', formatDate(envio.fechaEstimadaSalida)],
            ['Llegada estimada', formatDate(envio.fechaEstimadaLlegada)],
            ['Peso', formatKg(envio.pesoKg)],
          ] as const).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-navy/5 py-1">
              <dt className="text-navy/60">{k}</dt>
              <dd className="font-medium text-navy">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card className="mt-6">
        <CardTitle>Seguimiento</CardTitle>
        {eventos.length === 0 ? (
          <p className="mt-3 text-sm text-navy/50">Todavía no hay movimientos registrados.</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {eventos.map((e) => (
              <li key={e._id} className="border-l-2 border-sky/40 pl-3">
                <div className="flex flex-wrap items-center gap-2">
                  <EstadoBadge estado={e.estado} />
                  <span className="text-xs text-navy/60">{formatDateTime(e.timestamp)}</span>
                </div>
                {(e.ubicacion || e.descripcion) && (
                  <p className="mt-1 text-sm text-navy">{[e.ubicacion, e.descripcion].filter(Boolean).join(' · ')}</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Conversacion tipo="envio" id={envio.id} titulo="Mensajes con la empresa" ayuda="Escribe aquí cualquier duda sobre este envío; el equipo te responde y te avisa por correo." />
    </div>
  );
}
