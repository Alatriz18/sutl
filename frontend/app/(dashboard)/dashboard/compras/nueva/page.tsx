'use client';

import { FormEvent, useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardTitle } from '@/components/ui/card';
import { useToast } from '@/lib/toast-context';
import { extractApiError, formatMoney } from '@/lib/format';
import { INCOTERMS, fechaInputAIso } from '@/lib/purchase-orders';
import { Partner, PurchaseOrder } from '@/types';

interface LineaForm {
  key: number;
  sku: string;
  descripcion: string;
  cantidad: string;
  unidad: string;
  precioUnitario: string;
}

const SELECT = 'w-full rounded-md border border-navy/20 bg-white px-3 py-2 text-sm';

let keySeq = 0;
const lineaVacia = (): LineaForm => ({
  key: ++keySeq,
  sku: '',
  descripcion: '',
  cantidad: '',
  unidad: 'unidad',
  precioUnitario: '',
});

function Campo({ label, children, htmlFor }: { label: string; children: React.ReactNode; htmlFor: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-navy">
        {label}
      </label>
      {children}
    </div>
  );
}

export default function NuevaOrdenCompraPage() {
  const router = useRouter();
  const toast = useToast();
  const id = useId();
  const [proveedores, setProveedores] = useState<Partner[] | null>(null);
  const [form, setForm] = useState({
    numero: '',
    proveedorId: '',
    incoterm: '',
    moneda: 'USD',
    fechaRequerida: '',
    notas: '',
  });
  const [lineas, setLineas] = useState<LineaForm[]>([lineaVacia()]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .get<Partner[]>('/partners?tipo=proveedor')
      .then((res) => setProveedores(res.data.filter((p) => p.activo)))
      .catch(() => setProveedores([]));
  }, []);

  function update<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateLinea(key: number, field: keyof Omit<LineaForm, 'key'>, value: string) {
    setLineas((prev) => prev.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
  }

  const total = lineas.every((l) => l.precioUnitario !== '' && l.cantidad !== '')
    ? lineas.reduce((acc, l) => acc + Number(l.cantidad) * Number(l.precioUnitario), 0)
    : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post<PurchaseOrder>('/purchase-orders', {
        numero: form.numero.trim(),
        proveedorId: form.proveedorId,
        incoterm: form.incoterm || undefined,
        moneda: form.moneda,
        fechaRequerida: form.fechaRequerida ? fechaInputAIso(form.fechaRequerida) : undefined,
        notas: form.notas.trim() || undefined,
        lineas: lineas.map((l) => ({
          sku: l.sku.trim(),
          descripcion: l.descripcion.trim(),
          cantidad: Number(l.cantidad),
          unidad: l.unidad.trim() || undefined,
          precioUnitario: l.precioUnitario === '' ? undefined : Number(l.precioUnitario),
        })),
      });
      toast.success(`OC ${res.data.numero} creada en borrador.`);
      router.push(`/dashboard/compras/${res.data.id}`);
    } catch (err) {
      setError(extractApiError(err, 'No se pudo crear la orden de compra.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/dashboard/compras" className="text-sm text-sky hover:underline">
        ← Órdenes de compra
      </Link>
      <h1 className="mb-6 mt-2 text-2xl font-bold text-navy">Nueva orden de compra</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Card>
          <CardTitle>Cabecera</CardTitle>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo label="N° de OC (como está en tu ERP)" htmlFor={`${id}-numero`}>
              <Input
                id={`${id}-numero`}
                required
                maxLength={60}
                placeholder="Ej. OC-2026-0460"
                value={form.numero}
                onChange={(e) => update('numero', e.target.value)}
              />
            </Campo>
            <Campo label="Proveedor" htmlFor={`${id}-proveedor`}>
              <select
                id={`${id}-proveedor`}
                className={SELECT}
                required
                value={form.proveedorId}
                onChange={(e) => update('proveedorId', e.target.value)}
              >
                <option value="">{proveedores === null ? 'Cargando...' : 'Seleccionar proveedor...'}</option>
                {proveedores?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
              {proveedores?.length === 0 && (
                <p className="mt-1 text-xs text-navy/60">
                  No tienes proveedores registrados.{' '}
                  <Link href="/dashboard/contactos" className="text-sky hover:underline">
                    Créalo en Clientes y proveedores
                  </Link>{' '}
                  con tipo &quot;proveedor&quot;.
                </p>
              )}
            </Campo>
            <Campo label="Fecha requerida en planta" htmlFor={`${id}-requerida`}>
              <Input
                id={`${id}-requerida`}
                type="date"
                value={form.fechaRequerida}
                onChange={(e) => update('fechaRequerida', e.target.value)}
              />
            </Campo>
            <div className="grid grid-cols-2 gap-4">
              <Campo label="Incoterm" htmlFor={`${id}-incoterm`}>
                <select
                  id={`${id}-incoterm`}
                  className={SELECT}
                  value={form.incoterm}
                  onChange={(e) => update('incoterm', e.target.value)}
                >
                  <option value="">—</option>
                  {INCOTERMS.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo label="Moneda" htmlFor={`${id}-moneda`}>
                <select
                  id={`${id}-moneda`}
                  className={SELECT}
                  value={form.moneda}
                  onChange={(e) => update('moneda', e.target.value)}
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="CNY">CNY</option>
                </select>
              </Campo>
            </div>
            <div className="sm:col-span-2">
              <Campo label="Notas (opcional)" htmlFor={`${id}-notas`}>
                <textarea
                  id={`${id}-notas`}
                  rows={2}
                  maxLength={2000}
                  className={SELECT}
                  value={form.notas}
                  onChange={(e) => update('notas', e.target.value)}
                />
              </Campo>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <CardTitle>Líneas</CardTitle>
            <span className="text-sm text-navy/60">
              Total: <strong className="text-navy">{formatMoney(total, form.moneda)}</strong>
            </span>
          </div>
          <div className="mt-4 flex flex-col gap-4">
            {lineas.map((l, i) => (
              <fieldset key={l.key} className="rounded-lg border border-navy/10 p-3">
                <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-navy/50">
                  Línea {i + 1}
                </legend>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-12">
                  <div className="col-span-2 sm:col-span-3">
                    <Campo label="SKU" htmlFor={`${id}-sku-${l.key}`}>
                      <Input
                        id={`${id}-sku-${l.key}`}
                        required
                        maxLength={80}
                        value={l.sku}
                        onChange={(e) => updateLinea(l.key, 'sku', e.target.value)}
                      />
                    </Campo>
                  </div>
                  <div className="col-span-2 sm:col-span-4">
                    <Campo label="Descripción" htmlFor={`${id}-desc-${l.key}`}>
                      <Input
                        id={`${id}-desc-${l.key}`}
                        required
                        maxLength={300}
                        value={l.descripcion}
                        onChange={(e) => updateLinea(l.key, 'descripcion', e.target.value)}
                      />
                    </Campo>
                  </div>
                  <div className="sm:col-span-2">
                    <Campo label="Cantidad" htmlFor={`${id}-cant-${l.key}`}>
                      <Input
                        id={`${id}-cant-${l.key}`}
                        required
                        type="number"
                        min="0.0001"
                        step="any"
                        value={l.cantidad}
                        onChange={(e) => updateLinea(l.key, 'cantidad', e.target.value)}
                      />
                    </Campo>
                  </div>
                  <div className="sm:col-span-1">
                    <Campo label="Unidad" htmlFor={`${id}-uni-${l.key}`}>
                      <Input
                        id={`${id}-uni-${l.key}`}
                        maxLength={30}
                        value={l.unidad}
                        onChange={(e) => updateLinea(l.key, 'unidad', e.target.value)}
                      />
                    </Campo>
                  </div>
                  <div className="sm:col-span-2">
                    <Campo label="Precio unit." htmlFor={`${id}-precio-${l.key}`}>
                      <div className="flex gap-1">
                        <Input
                          id={`${id}-precio-${l.key}`}
                          type="number"
                          min="0"
                          step="any"
                          value={l.precioUnitario}
                          onChange={(e) => updateLinea(l.key, 'precioUnitario', e.target.value)}
                        />
                        {lineas.length > 1 && (
                          <button
                            type="button"
                            aria-label={`Quitar línea ${i + 1}`}
                            onClick={() => setLineas((prev) => prev.filter((x) => x.key !== l.key))}
                            className="rounded-md px-2 text-navy/40 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </Campo>
                  </div>
                </div>
              </fieldset>
            ))}
            <Button
              type="button"
              variant="ghost"
              className="self-start"
              onClick={() => setLineas((prev) => [...prev, lineaVacia()])}
            >
              <Plus size={16} /> Agregar línea
            </Button>
          </div>
        </Card>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={() => router.push('/dashboard/compras')}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Creando...' : 'Crear OC en borrador'}
          </Button>
        </div>
      </form>
    </div>
  );
}
