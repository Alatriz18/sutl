'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card, CardTitle } from '@/components/ui/card';
import { EstadoBadge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/format';
import { TrackingPublicoResponse } from '@/types';

export default function TrackingResultPage() {
  const { codigo } = useParams<{ codigo: string }>();
  const [data, setData] = useState<TrackingPublicoResponse | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<TrackingPublicoResponse>(`/shipments/tracking/${codigo}`)
      .then((res) => setData(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [codigo]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <Link href="/tracking" className="text-sm text-sky hover:underline">
          ← Buscar otro envío
        </Link>

        {loading && <p className="mt-6 text-navy/60">Buscando envío...</p>}

        {!loading && error && (
          <Card className="mt-6">
            <p className="text-red-600">
              No encontramos un envío con el código <strong>{codigo}</strong>. Verifica que esté
              escrito correctamente.
            </p>
          </Card>
        )}

        {!loading && data && (
          <>
            <Card className="mt-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>{data.codigoGuia}</CardTitle>
                  <p className="mt-1 text-navy/60">
                    {data.origen} → {data.destino}
                  </p>
                </div>
                <EstadoBadge estado={data.estado} />
              </div>
              <p className="mt-3 text-sm text-navy/60">
                Destinatario: <span className="text-navy">{data.destinatarioNombre}</span>
              </p>
            </Card>

            <div className="mt-6">
              <CardTitle className="mb-3">Historial</CardTitle>
              <ol className="space-y-3">
                {data.eventos.length === 0 && (
                  <p className="text-sm text-navy/50">Aún no hay eventos registrados.</p>
                )}
                {data.eventos.map((ev) => (
                  <li
                    key={ev._id}
                    className="rounded-lg border border-navy/10 bg-white p-4 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <EstadoBadge estado={ev.estado} />
                      <span className="text-navy/50">{formatDateTime(ev.timestamp)}</span>
                    </div>
                    {ev.ubicacion && <p className="mt-2 text-navy">📍 {ev.ubicacion}</p>}
                    {ev.descripcion && <p className="text-navy/70">{ev.descripcion}</p>}
                  </li>
                ))}
              </ol>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
