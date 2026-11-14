'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EstadoBadge } from '@/components/ui/badge';
import { extractApiError, formatDate } from '@/lib/format';
import type { EnvioDeCliente } from '@/types/portal';

// Inicio del cliente final: sus envíos, en solo lectura.
export default function MisEnviosPage() {
  const [envios, setEnvios] = useState<EnvioDeCliente[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setError(null);
    api
      .get<EnvioDeCliente[]>('/shipments')
      .then((r) => setEnvios(r.data))
      .catch((err) => setError(extractApiError(err, 'No se pudieron cargar tus envíos.')));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Mis envíos</h1>
      <p className="mt-1 text-navy/60">Dónde está tu carga, cuándo se espera y los mensajes con la empresa.</p>

      {error ? (
        <div className="mt-6 rounded-lg border border-navy/10 bg-white p-6 text-center">
          <p className="text-navy/70">{error}</p>
          <Button variant="ghost" className="mt-2" onClick={cargar}>Reintentar</Button>
        </div>
      ) : !envios ? (
        <Skeleton className="mt-6 h-48" />
      ) : envios.length === 0 ? (
        <p className="mt-6 rounded-lg border border-navy/10 bg-white p-6 text-center text-navy/60">Todavía no tienes envíos a tu nombre.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-navy/10 bg-white">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-navy/5 text-navy/70">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Guía</th>
                <th scope="col" className="px-4 py-3 font-medium">Ruta</th>
                <th scope="col" className="px-4 py-3 font-medium">Estado</th>
                <th scope="col" className="px-4 py-3 font-medium">Llegada estimada</th>
              </tr>
            </thead>
            <tbody>
              {envios.map((e) => (
                <tr key={e.id} className="border-t border-navy/5">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/mis-envios/${e.id}`} className="font-semibold text-navy hover:text-sky">{e.codigoGuia}</Link>
                  </td>
                  <td className="px-4 py-3 text-navy/70">{e.origen} → {e.destino}</td>
                  <td className="px-4 py-3"><EstadoBadge estado={e.estado} /></td>
                  <td className="px-4 py-3 text-navy/70">{formatDate(e.fechaEstimadaLlegada)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
