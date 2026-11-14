'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EstadoOcBadge } from '@/components/purchase-orders/estado-oc-badge';
import { extractApiError, formatDate, formatNumber } from '@/lib/format';
import type { OrdenDeProveedor } from '@/types/proveedor';

// Inicio del proveedor externo: sus órdenes de compra, en solo lectura.
export default function MisOrdenesPage() {
  const [ordenes, setOrdenes] = useState<OrdenDeProveedor[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setError(null);
    api
      .get<OrdenDeProveedor[]>('/purchase-orders')
      .then((r) => setOrdenes(r.data))
      .catch((err) => setError(extractApiError(err, 'No se pudieron cargar tus órdenes de compra.')));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Mis órdenes de compra</h1>
      <p className="mt-1 text-navy/60">Las órdenes que tu cliente te ha emitido, con lo pedido, lo recibido y los embarques en camino.</p>

      {error ? (
        <div className="mt-6 rounded-lg border border-navy/10 bg-white p-6 text-center">
          <p className="text-navy/70">{error}</p>
          <Button variant="ghost" className="mt-2" onClick={cargar}>Reintentar</Button>
        </div>
      ) : !ordenes ? (
        <Skeleton className="mt-6 h-48" />
      ) : ordenes.length === 0 ? (
        <p className="mt-6 rounded-lg border border-navy/10 bg-white p-6 text-center text-navy/60">Todavía no tienes órdenes de compra emitidas.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-navy/10 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-navy/5 text-navy/70">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Orden</th>
                <th scope="col" className="px-4 py-3 font-medium">Estado</th>
                <th scope="col" className="px-4 py-3 font-medium">Requerida</th>
                <th scope="col" className="px-4 py-3 font-medium">Confirmada por ti</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Recibido</th>
              </tr>
            </thead>
            <tbody>
              {ordenes.map((o) => {
                const pedido = o.lineas.reduce((s, l) => s + l.cantidad, 0);
                const recibido = o.lineas.reduce((s, l) => s + l.cantidadRecibida, 0);
                return (
                  <tr key={o.id} className="border-t border-navy/5">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/mis-ordenes/${o.id}`} className="font-semibold text-navy hover:text-sky">{o.numero}</Link>
                    </td>
                    <td className="px-4 py-3"><EstadoOcBadge estado={o.estado} /></td>
                    <td className="px-4 py-3 text-navy/70">{formatDate(o.fechaRequerida)}</td>
                    <td className="px-4 py-3 text-navy/70">{formatDate(o.fechaConfirmadaProveedor)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-navy/70">{formatNumber(recibido)} de {formatNumber(pedido)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
