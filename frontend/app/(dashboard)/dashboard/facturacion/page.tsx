'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TableSkeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useToast } from '@/lib/toast-context';
import { extractApiError, formatDate, formatMoney } from '@/lib/format';
import { EstadoFactura, Invoice, Partner, TipoFactura } from '@/types';

const ESTADO_COLOR: Record<EstadoFactura, string> = {
  pendiente: 'bg-[#fab219]/20 text-[#a86a00]',
  pagada: 'bg-emerald-100 text-emerald-700',
  vencida: 'bg-red-100 text-red-700',
  anulada: 'bg-slate-100 text-slate-700',
};

export default function FacturacionPage() {
  const toast = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<'todas' | TipoFactura>('todas');
  const [saving, setSaving] = useState(false);
  const [registrandoPago, setRegistrandoPago] = useState<string | null>(null);
  const [form, setForm] = useState({
    tipo: 'cxc' as TipoFactura,
    partnerId: '',
    montoTotal: '',
    fechaVencimiento: '',
  });

  async function cargar() {
    setLoading(true);
    const [iRes, pRes] = await Promise.all([
      api.get<Invoice[]>('/invoices'),
      api.get<Partner[]>('/partners'),
    ]);
    setInvoices(iRes.data);
    setPartners(pRes.data);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/invoices', {
        ...form,
        montoTotal: Number(form.montoTotal),
        fechaVencimiento: form.fechaVencimiento || undefined,
      });
      setForm((f) => ({ ...f, partnerId: '', montoTotal: '', fechaVencimiento: '' }));
      toast.success('Factura creada correctamente.');
      await cargar();
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo crear la factura.'));
    } finally {
      setSaving(false);
    }
  }

  async function pagarCompleto(inv: Invoice) {
    const pagado = (inv.pagos ?? []).reduce((acc, p) => acc + p.monto, 0);
    const restante = inv.montoTotal - pagado;
    if (restante <= 0) return;
    setRegistrandoPago(inv.id);
    try {
      await api.post(`/invoices/${inv.id}/pagos`, { monto: restante });
      toast.success(`Factura ${inv.numero} marcada como pagada.`);
      await cargar();
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo registrar el pago.'));
    } finally {
      setRegistrandoPago(null);
    }
  }

  const visibles = filtro === 'todas' ? invoices : invoices.filter((f) => f.tipo === filtro);
  const totalCxc = useMemo(
    () => invoices.filter((f) => f.tipo === 'cxc' && f.estado !== 'pagada').length,
    [invoices],
  );
  const totalCxp = useMemo(
    () => invoices.filter((f) => f.tipo === 'cxp' && f.estado !== 'pagada').length,
    [invoices],
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Facturación</h1>
      <p className="mt-1 text-navy/60">
        Cuentas por cobrar (clientes) y cuentas por pagar (navieras/proveedores).
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card className="flex items-center gap-3">
              <span className="rounded-md bg-sky/10 p-2 text-sky">
                <ArrowDownCircle size={20} />
              </span>
              <div>
                <p className="text-sm text-navy/60">Por cobrar (CxC)</p>
                <p className="text-xl font-bold text-navy">{totalCxc} facturas pendientes</p>
              </div>
            </Card>
            <Card className="flex items-center gap-3">
              <span className="rounded-md bg-[#d03b3b]/10 p-2 text-[#d03b3b]">
                <ArrowUpCircle size={20} />
              </span>
              <div>
                <p className="text-sm text-navy/60">Por pagar (CxP)</p>
                <p className="text-xl font-bold text-navy">{totalCxp} facturas pendientes</p>
              </div>
            </Card>
          </div>

          <div className="mb-4 flex gap-2">
            {(['todas', 'cxc', 'cxp'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFiltro(f)}
                className={cn(
                  'rounded-full px-3 py-1 text-sm font-medium transition-colors',
                  filtro === f ? 'bg-navy text-white' : 'bg-navy/5 text-navy/60 hover:bg-navy/10',
                )}
              >
                {f === 'todas' ? 'Todas' : f.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-lg border border-navy/10 bg-white">
            {loading ? (
              <TableSkeleton rows={4} cols={7} />
            ) : (
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-navy/5 text-navy/70">
                  <tr>
                    <th className="px-4 py-3 font-medium">Número</th>
                    <th className="px-4 py-3 font-medium">Tipo</th>
                    <th className="px-4 py-3 font-medium">Contraparte</th>
                    <th className="px-4 py-3 font-medium">Monto</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium">Emisión</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-navy/50">
                        Aún no hay facturas.
                      </td>
                    </tr>
                  )}
                  {visibles.map((f) => (
                    <tr key={f.id} className="border-t border-navy/5">
                      <td className="px-4 py-3 font-medium text-navy">{f.numero}</td>
                      <td className="px-4 py-3 text-navy/60 uppercase">{f.tipo}</td>
                      <td className="px-4 py-3 text-navy/70">{f.partner?.nombre ?? '—'}</td>
                      <td className="px-4 py-3 text-navy">{formatMoney(f.montoTotal, f.moneda)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
                            ESTADO_COLOR[f.estado],
                          )}
                        >
                          {f.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-navy/50">{formatDate(f.fechaEmision)}</td>
                      <td className="px-4 py-3 text-right">
                        {f.estado !== 'pagada' && f.estado !== 'anulada' && (
                          <button
                            disabled={registrandoPago === f.id}
                            onClick={() => pagarCompleto(f)}
                            className="text-xs font-medium text-sky hover:underline disabled:opacity-40"
                          >
                            {registrandoPago === f.id ? 'Registrando...' : 'Marcar pagada'}
                          </button>
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
          <CardTitle>Nueva factura</CardTitle>
          <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-3">
            <select
              className="w-full rounded-md border border-navy/20 px-3 py-2 text-sm"
              value={form.tipo}
              onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as TipoFactura }))}
            >
              <option value="cxc">Cuenta por cobrar (cliente)</option>
              <option value="cxp">Cuenta por pagar (proveedor)</option>
            </select>
            <select
              className="w-full rounded-md border border-navy/20 px-3 py-2 text-sm"
              required
              value={form.partnerId}
              onChange={(e) => setForm((f) => ({ ...f, partnerId: e.target.value }))}
            >
              <option value="">Contraparte...</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} ({p.tipo})
                </option>
              ))}
            </select>
            <Input
              type="number"
              step="0.01"
              placeholder="Monto total (USD)"
              required
              value={form.montoTotal}
              onChange={(e) => setForm((f) => ({ ...f, montoTotal: e.target.value }))}
            />
            <div>
              <label className="mb-1 block text-sm font-medium text-navy">
                Fecha de vencimiento (opcional)
              </label>
              <Input
                type="date"
                value={form.fechaVencimiento}
                onChange={(e) => setForm((f) => ({ ...f, fechaVencimiento: e.target.value }))}
              />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? 'Creando...' : 'Crear factura'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
