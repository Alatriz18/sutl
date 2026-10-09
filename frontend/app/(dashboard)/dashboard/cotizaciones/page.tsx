'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardTitle } from '@/components/ui/card';
import { TableSkeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useToast } from '@/lib/toast-context';
import { extractApiError, formatMoney } from '@/lib/format';
import { Carrier, EstadoCotizacion, ModoTransporte, Partner, Quote, TipoEnvio } from '@/types';

const ESTADO_COLOR: Record<EstadoCotizacion, string> = {
  borrador: 'bg-slate-100 text-slate-700',
  enviada: 'bg-sky/10 text-sky',
  aprobada: 'bg-emerald-100 text-emerald-700',
  rechazada: 'bg-red-100 text-red-700',
  convertida: 'bg-gold/10 text-gold',
};

export default function CotizacionesPage() {
  const toast = useToast();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [clientes, setClientes] = useState<Partner[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    clienteId: '',
    tipo: 'exportacion' as TipoEnvio,
    modo: 'maritimo' as ModoTransporte,
    carrierId: '',
    origen: '',
    destino: '',
    pesoKg: '',
    tarifaEstimada: '',
    notas: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    setLoading(true);
    const [qRes, pRes, cRes] = await Promise.all([
      api.get<Quote[]>('/quotes'),
      api.get<Partner[]>('/partners?tipo=cliente'),
      api.get<Carrier[]>('/carriers'),
    ]);
    setQuotes(qRes.data);
    setClientes(pRes.data);
    setCarriers(cRes.data);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.post('/quotes', {
        ...form,
        carrierId: form.carrierId || undefined,
        pesoKg: form.pesoKg ? Number(form.pesoKg) : undefined,
        tarifaEstimada: form.tarifaEstimada ? Number(form.tarifaEstimada) : undefined,
        notas: form.notas || undefined,
      });
      setForm({
        clienteId: '',
        tipo: form.tipo,
        modo: form.modo,
        carrierId: '',
        origen: '',
        destino: '',
        pesoKg: '',
        tarifaEstimada: '',
        notas: '',
      });
      toast.success('Cotización creada correctamente.');
      await cargar();
    } catch (err) {
      setError(extractApiError(err, 'No se pudo crear la cotización. Verifica los datos.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Cotizaciones</h1>
      <p className="mt-1 text-navy/60">Solicitud de flete de un cliente antes de reservar el envío.</p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="overflow-x-auto rounded-lg border border-navy/10 bg-white">
            {loading ? (
              <TableSkeleton rows={4} cols={6} />
            ) : (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-navy/5 text-navy/70">
                <tr>
                  <th className="px-4 py-3 font-medium">Número</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Ruta</th>
                  <th className="px-4 py-3 font-medium">Tarifa est.</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {quotes.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-navy/50">
                      Aún no hay cotizaciones.
                    </td>
                  </tr>
                )}
                {quotes.map((q) => (
                  <tr key={q.id} className="border-t border-navy/5">
                    <td className="px-4 py-3 font-medium text-navy">{q.numero}</td>
                    <td className="px-4 py-3 text-navy/70">{q.cliente?.nombre ?? '—'}</td>
                    <td className="px-4 py-3 text-navy/60">
                      {q.origen} → {q.destino}
                    </td>
                    <td className="px-4 py-3 text-navy/60">
                      {formatMoney(q.tarifaEstimada, q.moneda)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium capitalize', ESTADO_COLOR[q.estado])}>
                        {q.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {q.estado !== 'convertida' && (
                        <Link
                          href={`/dashboard/reservas/nueva?quoteId=${q.id}`}
                          className="text-xs font-medium text-sky hover:underline"
                        >
                          Crear reserva →
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>
        </div>

        <Card>
          <CardTitle>Nueva cotización</CardTitle>
          <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-3">
            <select
              className="w-full rounded-md border border-navy/20 px-3 py-2 text-sm"
              required
              value={form.clienteId}
              onChange={(e) => setForm((f) => ({ ...f, clienteId: e.target.value }))}
            >
              <option value="">Seleccionar cliente...</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <select
                className="w-full rounded-md border border-navy/20 px-3 py-2 text-sm"
                value={form.tipo}
                onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as TipoEnvio }))}
              >
                <option value="exportacion">Exportación</option>
                <option value="importacion">Importación</option>
              </select>
              <select
                className="w-full rounded-md border border-navy/20 px-3 py-2 text-sm"
                value={form.modo}
                onChange={(e) => setForm((f) => ({ ...f, modo: e.target.value as ModoTransporte }))}
              >
                <option value="maritimo">Marítimo</option>
                <option value="aereo">Aéreo</option>
                <option value="terrestre">Terrestre</option>
              </select>
            </div>
            <select
              className="w-full rounded-md border border-navy/20 px-3 py-2 text-sm"
              value={form.carrierId}
              onChange={(e) => setForm((f) => ({ ...f, carrierId: e.target.value }))}
            >
              <option value="">Naviera/aerolínea (opcional)</option>
              {carriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Origen"
                required
                value={form.origen}
                onChange={(e) => setForm((f) => ({ ...f, origen: e.target.value }))}
              />
              <Input
                placeholder="Destino"
                required
                value={form.destino}
                onChange={(e) => setForm((f) => ({ ...f, destino: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                placeholder="Peso (kg)"
                value={form.pesoKg}
                onChange={(e) => setForm((f) => ({ ...f, pesoKg: e.target.value }))}
              />
              <Input
                type="number"
                placeholder="Tarifa est. (USD)"
                value={form.tarifaEstimada}
                onChange={(e) => setForm((f) => ({ ...f, tarifaEstimada: e.target.value }))}
              />
            </div>
            <Input
              placeholder="Notas (opcional)"
              value={form.notas}
              onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={saving}>
              {saving ? 'Creando...' : 'Crear cotización'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
