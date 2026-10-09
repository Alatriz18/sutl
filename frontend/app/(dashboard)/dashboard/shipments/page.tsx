'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EstadoBadge } from '@/components/ui/badge';
import { TableSkeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/format';
import { EstadoEnvio, Shipment } from '@/types';

const MODO_LABELS: Record<Shipment['modo'], string> = {
  maritimo: 'Marítimo',
  aereo: 'Aéreo',
  terrestre: 'Terrestre',
};

const TIPO_LABELS: Record<Shipment['tipo'], string> = {
  importacion: 'Importación',
  exportacion: 'Exportación',
};

const ESTADOS: EstadoEnvio[] = ['creado', 'en_transito', 'en_aduana', 'entregado', 'incidencia'];

export default function ShipmentsListPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<EstadoEnvio | 'todos'>('todos');

  useEffect(() => {
    api
      .get<Shipment[]>('/shipments')
      .then((res) => setShipments(res.data))
      .finally(() => setLoading(false));
  }, []);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return shipments.filter((s) => {
      const matchQ =
        !q ||
        s.codigoGuia.toLowerCase().includes(q) ||
        s.destinatarioNombre.toLowerCase().includes(q) ||
        s.remitenteNombre.toLowerCase().includes(q);
      const matchEstado = filtroEstado === 'todos' || s.estado === filtroEstado;
      return matchQ && matchEstado;
    });
  }, [shipments, busqueda, filtroEstado]);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-navy">Envíos</h1>
        <Link href="/dashboard/shipments/nuevo">
          <Button className="w-full sm:w-auto">+ Nuevo envío</Button>
        </Link>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy/40" />
          <Input
            className="pl-9"
            placeholder="Buscar por guía, remitente o destinatario..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <select
          className="rounded-md border border-navy/20 px-3 py-2 text-sm sm:w-56"
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value as EstadoEnvio | 'todos')}
        >
          <option value="todos">Todos los estados</option>
          {ESTADOS.map((e) => (
            <option key={e} value={e}>
              {e.replace('_', ' ')}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-navy/10 bg-white">
        {loading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : (
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-navy/5 text-navy/70">
              <tr>
                <th className="px-4 py-3 font-medium">Código de guía</th>
                <th className="px-4 py-3 font-medium">Tipo / Modo</th>
                <th className="px-4 py-3 font-medium">Naviera</th>
                <th className="px-4 py-3 font-medium">Destinatario</th>
                <th className="px-4 py-3 font-medium">Origen → Destino</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Creado</th>
              </tr>
            </thead>
            <tbody>
              {visibles.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-navy/50">
                    {shipments.length === 0
                      ? 'Aún no hay envíos registrados.'
                      : 'Ningún envío coincide con la búsqueda.'}
                  </td>
                </tr>
              )}
              {visibles.map((s) => (
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
                  <td className="px-4 py-3 text-navy/60">{s.carrier?.nombre ?? '—'}</td>
                  <td className="px-4 py-3">{s.destinatarioNombre}</td>
                  <td className="px-4 py-3 text-navy/70">
                    {s.origen} → {s.destino}
                  </td>
                  <td className="px-4 py-3">
                    <EstadoBadge estado={s.estado} />
                  </td>
                  <td className="px-4 py-3 text-navy/60">{formatDate(s.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
