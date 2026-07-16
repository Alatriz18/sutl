'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { EstadoBadge } from '@/components/ui/badge';
import { Shipment } from '@/types';

const MODO_LABELS: Record<Shipment['modo'], string> = {
  maritimo: 'Marítimo',
  aereo: 'Aéreo',
  terrestre: 'Terrestre',
};

const TIPO_LABELS: Record<Shipment['tipo'], string> = {
  importacion: 'Importación',
  exportacion: 'Exportación',
};

export default function ShipmentsListPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Shipment[]>('/shipments')
      .then((res) => setShipments(res.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy">Envíos</h1>
        <Link href="/dashboard/shipments/nuevo">
          <Button>+ Nuevo envío</Button>
        </Link>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-navy/10 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-navy/5 text-navy/70">
            <tr>
              <th className="px-4 py-3 font-medium">Código de guía</th>
              <th className="px-4 py-3 font-medium">Tipo / Modo</th>
              <th className="px-4 py-3 font-medium">Destinatario</th>
              <th className="px-4 py-3 font-medium">Origen → Destino</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Creado</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-navy/50">
                  Cargando envíos...
                </td>
              </tr>
            )}
            {!loading && shipments.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-navy/50">
                  Aún no hay envíos registrados.
                </td>
              </tr>
            )}
            {shipments.map((s) => (
              <tr key={s.id} className="border-t border-navy/5 hover:bg-navy/5">
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/shipments/${s.id}`}
                    className="font-medium text-sky hover:underline"
                  >
                    {s.codigoGuia}
                  </Link>
                </td>
                <td className="px-4 py-3 text-navy/70">
                  {TIPO_LABELS[s.tipo]} · {MODO_LABELS[s.modo]}
                </td>
                <td className="px-4 py-3">{s.destinatarioNombre}</td>
                <td className="px-4 py-3">
                  {s.origen} → {s.destino}
                </td>
                <td className="px-4 py-3">
                  <EstadoBadge estado={s.estado} />
                </td>
                <td className="px-4 py-3 text-navy/60">
                  {new Date(s.createdAt).toLocaleDateString('es-EC')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
