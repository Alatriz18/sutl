'use client';

import { FormEvent, useEffect, useState } from 'react';
import { DollarSign, FileSignature } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TableSkeleton } from '@/components/ui/skeleton';
import { useToast } from '@/lib/toast-context';
import { extractApiError, formatDate, formatMoney } from '@/lib/format';
import { Carrier, Contract, ModoTransporte, Rate, TipoEnvio } from '@/types';

const MODO_LABELS: Record<ModoTransporte, string> = {
  maritimo: 'Marítimo',
  aereo: 'Aéreo',
  terrestre: 'Terrestre',
};

export default function TarifasPage() {
  const toast = useToast();
  const [rates, setRates] = useState<Rate[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingRate, setSavingRate] = useState(false);
  const [rateForm, setRateForm] = useState({
    carrierId: '',
    origen: '',
    destino: '',
    modo: 'maritimo' as ModoTransporte,
    tipo: 'exportacion' as TipoEnvio,
    unidad: 'contenedor_40',
    precioBase: '',
  });

  async function cargar() {
    setLoading(true);
    const [rRes, cRes, carRes] = await Promise.all([
      api.get<Rate[]>('/rates'),
      api.get<Contract[]>('/contracts'),
      api.get<Carrier[]>('/carriers'),
    ]);
    setRates(rRes.data);
    setContracts(cRes.data);
    setCarriers(carRes.data);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function handleSubmitRate(e: FormEvent) {
    e.preventDefault();
    setSavingRate(true);
    try {
      await api.post('/rates', { ...rateForm, precioBase: Number(rateForm.precioBase) });
      setRateForm((f) => ({ ...f, origen: '', destino: '', precioBase: '' }));
      toast.success('Tarifa creada correctamente.');
      await cargar();
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo crear la tarifa.'));
    } finally {
      setSavingRate(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Tarifas y contratos</h1>
      <p className="mt-1 text-navy/60">Costo de flete por naviera/ruta/modo y contratos marco.</p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CardTitle className="mb-3">Tarifas vigentes</CardTitle>
          <div className="overflow-x-auto rounded-lg border border-navy/10 bg-white">
            {loading ? (
              <TableSkeleton rows={4} cols={6} />
            ) : (
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-navy/5 text-navy/70">
                  <tr>
                    <th className="px-4 py-3 font-medium">Naviera</th>
                    <th className="px-4 py-3 font-medium">Ruta</th>
                    <th className="px-4 py-3 font-medium">Modo</th>
                    <th className="px-4 py-3 font-medium">Unidad</th>
                    <th className="px-4 py-3 font-medium">Precio</th>
                    <th className="px-4 py-3 font-medium">Vigencia</th>
                  </tr>
                </thead>
                <tbody>
                  {rates.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-navy/50">
                        Aún no hay tarifas registradas.
                      </td>
                    </tr>
                  )}
                  {rates.map((r) => (
                    <tr key={r.id} className="border-t border-navy/5">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2 font-medium text-navy">
                          <DollarSign size={14} className="text-navy/40" />
                          {r.carrier?.nombre ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-navy/70">
                        {r.origen} → {r.destino}
                      </td>
                      <td className="px-4 py-3 text-navy/60">{MODO_LABELS[r.modo]}</td>
                      <td className="px-4 py-3 text-navy/60">{r.unidad.replace('_', ' ')}</td>
                      <td className="px-4 py-3 font-medium text-navy">
                        {formatMoney(r.precioBase, r.moneda)}
                      </td>
                      <td className="px-4 py-3 text-navy/50">
                        {r.vigenteHasta ? `hasta ${formatDate(r.vigenteHasta)}` : 'indefinida'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <CardTitle className="mb-3 mt-8">Contratos marco</CardTitle>
          {loading ? (
            <TableSkeleton rows={2} cols={2} />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {contracts.length === 0 && (
                <p className="text-sm text-navy/50">Aún no hay contratos registrados.</p>
              )}
              {contracts.map((c) => (
                <Card key={c.id}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-navy">{c.carrier?.nombre}</p>
                      <p className="text-sm text-navy/60">{c.nombre}</p>
                    </div>
                    <span className="rounded-md bg-navy/10 p-2 text-navy">
                      <FileSignature size={16} />
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-navy/40">
                    Vigencia: {formatDate(c.vigenteDesde)}
                    {c.vigenteHasta ? ` → ${formatDate(c.vigenteHasta)}` : ''}
                  </p>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Card>
          <CardTitle>Nueva tarifa</CardTitle>
          <form onSubmit={handleSubmitRate} className="mt-3 flex flex-col gap-3">
            <select
              className="w-full rounded-md border border-navy/20 px-3 py-2 text-sm"
              required
              value={rateForm.carrierId}
              onChange={(e) => setRateForm((f) => ({ ...f, carrierId: e.target.value }))}
            >
              <option value="">Naviera / aerolínea...</option>
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
                value={rateForm.origen}
                onChange={(e) => setRateForm((f) => ({ ...f, origen: e.target.value }))}
              />
              <Input
                placeholder="Destino"
                required
                value={rateForm.destino}
                onChange={(e) => setRateForm((f) => ({ ...f, destino: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                className="w-full rounded-md border border-navy/20 px-3 py-2 text-sm"
                value={rateForm.modo}
                onChange={(e) => setRateForm((f) => ({ ...f, modo: e.target.value as ModoTransporte }))}
              >
                <option value="maritimo">Marítimo</option>
                <option value="aereo">Aéreo</option>
                <option value="terrestre">Terrestre</option>
              </select>
              <select
                className="w-full rounded-md border border-navy/20 px-3 py-2 text-sm"
                value={rateForm.tipo}
                onChange={(e) => setRateForm((f) => ({ ...f, tipo: e.target.value as TipoEnvio }))}
              >
                <option value="exportacion">Exportación</option>
                <option value="importacion">Importación</option>
              </select>
            </div>
            <Input
              placeholder="Unidad (ej. contenedor_40, kg)"
              required
              value={rateForm.unidad}
              onChange={(e) => setRateForm((f) => ({ ...f, unidad: e.target.value }))}
            />
            <Input
              type="number"
              step="0.01"
              placeholder="Precio base (USD)"
              required
              value={rateForm.precioBase}
              onChange={(e) => setRateForm((f) => ({ ...f, precioBase: e.target.value }))}
            />
            <Button type="submit" disabled={savingRate}>
              {savingRate ? 'Creando...' : 'Crear tarifa'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
