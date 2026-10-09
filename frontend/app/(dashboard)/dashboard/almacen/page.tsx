'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Warehouse as WarehouseIcon, Package2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TableSkeleton } from '@/components/ui/skeleton';
import { useToast } from '@/lib/toast-context';
import { extractApiError } from '@/lib/format';
import { InventoryItem, Warehouse } from '@/types';

export default function AlmacenPage() {
  const toast = useToast();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingWarehouse, setSavingWarehouse] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [warehouseForm, setWarehouseForm] = useState({ nombre: '', direccion: '' });
  const [itemForm, setItemForm] = useState({
    warehouseId: '',
    sku: '',
    descripcion: '',
    cantidad: '',
    unidad: 'unidad',
  });

  async function cargar() {
    setLoading(true);
    const [wRes, iRes] = await Promise.all([
      api.get<Warehouse[]>('/warehouses'),
      api.get<InventoryItem[]>('/inventory-items'),
    ]);
    setWarehouses(wRes.data);
    setItems(iRes.data);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function handleCreateWarehouse(e: FormEvent) {
    e.preventDefault();
    setSavingWarehouse(true);
    try {
      await api.post('/warehouses', {
        ...warehouseForm,
        direccion: warehouseForm.direccion || undefined,
      });
      setWarehouseForm({ nombre: '', direccion: '' });
      toast.success('Bodega creada correctamente.');
      await cargar();
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo crear la bodega.'));
    } finally {
      setSavingWarehouse(false);
    }
  }

  async function handleCreateItem(e: FormEvent) {
    e.preventDefault();
    setSavingItem(true);
    try {
      await api.post('/inventory-items', {
        ...itemForm,
        sku: itemForm.sku || undefined,
        cantidad: Number(itemForm.cantidad),
      });
      setItemForm((f) => ({ ...f, sku: '', descripcion: '', cantidad: '' }));
      toast.success('Ítem agregado al inventario.');
      await cargar();
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo crear el ítem.'));
    } finally {
      setSavingItem(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Almacén e inventario</h1>
      <p className="mt-1 text-navy/60">Bodegas, ubicaciones y stock consolidado (WMS).</p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TableSkeleton rows={1} cols={2} />
            </div>
          ) : (
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {warehouses.length === 0 && (
                <p className="text-sm text-navy/50">Aún no hay bodegas registradas.</p>
              )}
              {warehouses.map((w) => (
                <Card key={w.id} className="flex items-center gap-3">
                  <span className="rounded-md bg-navy/10 p-2 text-navy">
                    <WarehouseIcon size={20} />
                  </span>
                  <div>
                    <p className="font-medium text-navy">{w.nombre}</p>
                    <p className="text-sm text-navy/60">
                      {w.ubicaciones?.length ?? 0} ubicaciones · {w._count?.items ?? 0} ítems
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          )}

          <CardTitle className="mb-3">Inventario</CardTitle>
          <div className="overflow-x-auto rounded-lg border border-navy/10 bg-white">
            {loading ? (
              <TableSkeleton rows={4} cols={5} />
            ) : (
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-navy/5 text-navy/70">
                  <tr>
                    <th className="px-4 py-3 font-medium">SKU</th>
                    <th className="px-4 py-3 font-medium">Descripción</th>
                    <th className="px-4 py-3 font-medium">Bodega</th>
                    <th className="px-4 py-3 font-medium">Ubicación</th>
                    <th className="px-4 py-3 font-medium">Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-navy/50">
                        Aún no hay ítems en inventario.
                      </td>
                    </tr>
                  )}
                  {items.map((i) => (
                    <tr key={i.id} className="border-t border-navy/5">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2 font-medium text-navy">
                          <Package2 size={14} className="text-navy/40" />
                          {i.sku ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-navy/70">{i.descripcion}</td>
                      <td className="px-4 py-3 text-navy/60">{i.warehouse?.nombre ?? '—'}</td>
                      <td className="px-4 py-3 text-navy/60">{i.ubicacion?.codigo ?? '—'}</td>
                      <td className="px-4 py-3 text-navy">
                        {i.cantidad} {i.unidad}
                        {i.cantidad !== 1 ? 's' : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardTitle>Nueva bodega</CardTitle>
            <form onSubmit={handleCreateWarehouse} className="mt-3 flex flex-col gap-3">
              <Input
                placeholder="Nombre"
                required
                value={warehouseForm.nombre}
                onChange={(e) => setWarehouseForm((f) => ({ ...f, nombre: e.target.value }))}
              />
              <Input
                placeholder="Dirección (opcional)"
                value={warehouseForm.direccion}
                onChange={(e) => setWarehouseForm((f) => ({ ...f, direccion: e.target.value }))}
              />
              <Button type="submit" disabled={savingWarehouse}>
                {savingWarehouse ? 'Creando...' : 'Crear bodega'}
              </Button>
            </form>
          </Card>

          <Card>
            <CardTitle>Nuevo ítem</CardTitle>
            <form onSubmit={handleCreateItem} className="mt-3 flex flex-col gap-3">
              <select
                className="w-full rounded-md border border-navy/20 px-3 py-2 text-sm"
                required
                value={itemForm.warehouseId}
                onChange={(e) => setItemForm((f) => ({ ...f, warehouseId: e.target.value }))}
              >
                <option value="">Bodega...</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.nombre}
                  </option>
                ))}
              </select>
              <Input
                placeholder="SKU (opcional)"
                value={itemForm.sku}
                onChange={(e) => setItemForm((f) => ({ ...f, sku: e.target.value }))}
              />
              <Input
                placeholder="Descripción"
                required
                value={itemForm.descripcion}
                onChange={(e) => setItemForm((f) => ({ ...f, descripcion: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  placeholder="Cantidad"
                  required
                  value={itemForm.cantidad}
                  onChange={(e) => setItemForm((f) => ({ ...f, cantidad: e.target.value }))}
                />
                <Input
                  placeholder="Unidad"
                  value={itemForm.unidad}
                  onChange={(e) => setItemForm((f) => ({ ...f, unidad: e.target.value }))}
                />
              </div>
              <Button type="submit" disabled={savingItem}>
                {savingItem ? 'Guardando...' : 'Agregar ítem'}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
