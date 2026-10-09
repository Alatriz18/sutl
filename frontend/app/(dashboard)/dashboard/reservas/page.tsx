'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { TableSkeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useToast } from '@/lib/toast-context';
import { extractApiError } from '@/lib/format';
import { Booking, EstadoReserva } from '@/types';

const ESTADO_COLOR: Record<EstadoReserva, string> = {
  pendiente: 'bg-slate-100 text-slate-700',
  confirmada: 'bg-sky/10 text-sky',
  cancelada: 'bg-red-100 text-red-700',
  convertida: 'bg-emerald-100 text-emerald-700',
};

export default function ReservasPage() {
  const router = useRouter();
  const toast = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [convirtiendo, setConvirtiendo] = useState<string | null>(null);

  async function cargar() {
    setLoading(true);
    const res = await api.get<Booking[]>('/bookings');
    setBookings(res.data);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function convertir(id: string) {
    setConvirtiendo(id);
    try {
      const res = await api.post(`/bookings/${id}/convertir-a-envio`);
      toast.success('Reserva convertida en envío.');
      router.push(`/dashboard/shipments/${res.data.id}`);
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo convertir la reserva en envío.'));
    } finally {
      setConvirtiendo(null);
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Reservas</h1>
          <p className="mt-1 text-navy/60">Booking confirmado — un paso antes del envío real.</p>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => router.push('/dashboard/reservas/nueva')}>
          + Nueva reserva
        </Button>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-navy/10 bg-white">
        {loading ? (
          <TableSkeleton rows={4} cols={5} />
        ) : (
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-navy/5 text-navy/70">
            <tr>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Ruta</th>
              <th className="px-4 py-3 font-medium">Modo</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {bookings.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-navy/50">
                  Aún no hay reservas.
                </td>
              </tr>
            )}
            {bookings.map((b) => (
              <tr key={b.id} className="border-t border-navy/5">
                <td className="px-4 py-3 font-medium text-navy">{b.cliente?.nombre ?? '—'}</td>
                <td className="px-4 py-3 text-navy/60">
                  {b.origen} → {b.destino}
                </td>
                <td className="px-4 py-3 text-navy/60 capitalize">{b.modo}</td>
                <td className="px-4 py-3">
                  <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium capitalize', ESTADO_COLOR[b.estado])}>
                    {b.estado}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {b.estado === 'confirmada' && !b.shipment && (
                    <Button
                      variant="secondary"
                      className="px-3 py-1.5 text-xs"
                      disabled={convirtiendo === b.id}
                      onClick={() => convertir(b.id)}
                    >
                      {convirtiendo === b.id ? 'Convirtiendo...' : 'Convertir a envío'}
                    </Button>
                  )}
                  {b.shipment && (
                    <a
                      href={`/dashboard/shipments/${b.shipment.id}`}
                      className="text-xs font-medium text-sky hover:underline"
                    >
                      Ver envío {b.shipment.codigoGuia}
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
}
