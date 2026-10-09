'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardTitle } from '@/components/ui/card';
import { useToast } from '@/lib/toast-context';
import { extractApiError } from '@/lib/format';
import { Carrier, ModoTransporte, Partner, Quote, TipoEnvio } from '@/types';

function NuevaReservaForm() {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const quoteId = searchParams.get('quoteId');

  const [clientes, setClientes] = useState<Partner[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [form, setForm] = useState({
    quoteId: quoteId ?? '',
    clienteId: '',
    tipo: 'exportacion' as TipoEnvio,
    modo: 'maritimo' as ModoTransporte,
    carrierId: '',
    origen: '',
    destino: '',
    fechaEstimadaCarga: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([api.get<Partner[]>('/partners?tipo=cliente'), api.get<Carrier[]>('/carriers')]).then(
      ([pRes, cRes]) => {
        setClientes(pRes.data);
        setCarriers(cRes.data);
      },
    );
  }, []);

  useEffect(() => {
    if (!quoteId) return;
    api.get<Quote>(`/quotes/${quoteId}`).then((res) => {
      const q = res.data;
      setForm((f) => ({
        ...f,
        quoteId,
        clienteId: q.clienteId,
        tipo: q.tipo,
        modo: q.modo,
        carrierId: q.carrierId ?? '',
        origen: q.origen,
        destino: q.destino,
      }));
    });
  }, [quoteId]);

  function update<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post('/bookings', {
        ...form,
        quoteId: form.quoteId || undefined,
        carrierId: form.carrierId || undefined,
        fechaEstimadaCarga: form.fechaEstimadaCarga || undefined,
      });
      toast.success('Reserva creada correctamente.');
      router.push('/dashboard/reservas');
    } catch (err) {
      setError(extractApiError(err, 'No se pudo crear la reserva.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-2xl font-bold text-navy">Nueva reserva</h1>
      <Card>
        <CardTitle>
          {quoteId ? 'Reserva a partir de cotización' : 'Datos de la reserva'}
        </CardTitle>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-navy">Cliente</label>
            <select
              className="w-full rounded-md border border-navy/20 px-3 py-2 text-sm"
              required
              value={form.clienteId}
              onChange={(e) => update('clienteId', e.target.value)}
            >
              <option value="">Seleccionar cliente...</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-navy">Tipo</label>
              <select
                className="w-full rounded-md border border-navy/20 px-3 py-2 text-sm"
                value={form.tipo}
                onChange={(e) => update('tipo', e.target.value as TipoEnvio)}
              >
                <option value="exportacion">Exportación</option>
                <option value="importacion">Importación</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-navy">Modo</label>
              <select
                className="w-full rounded-md border border-navy/20 px-3 py-2 text-sm"
                value={form.modo}
                onChange={(e) => update('modo', e.target.value as ModoTransporte)}
              >
                <option value="maritimo">Marítimo</option>
                <option value="aereo">Aéreo</option>
                <option value="terrestre">Terrestre</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-navy">Naviera/aerolínea (opcional)</label>
            <select
              className="w-full rounded-md border border-navy/20 px-3 py-2 text-sm"
              value={form.carrierId}
              onChange={(e) => update('carrierId', e.target.value)}
            >
              <option value="">Sin asignar</option>
              {carriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-navy">Origen</label>
              <Input required value={form.origen} onChange={(e) => update('origen', e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-navy">Destino</label>
              <Input required value={form.destino} onChange={(e) => update('destino', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-navy">
              Fecha estimada de carga (opcional)
            </label>
            <Input
              type="date"
              value={form.fechaEstimadaCarga}
              onChange={(e) => update('fechaEstimadaCarga', e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" disabled={loading} className="mt-2">
            {loading ? 'Creando...' : 'Crear reserva'}
          </Button>
        </form>
      </Card>
    </div>
  );
}

export default function NuevaReservaPage() {
  return (
    <Suspense fallback={<p className="text-navy/50">Cargando...</p>}>
      <NuevaReservaForm />
    </Suspense>
  );
}
