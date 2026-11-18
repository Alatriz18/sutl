'use client';

import { FormEvent, useCallback, useEffect, useId, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Conversacion } from '@/components/portal/conversacion';
import { useToast } from '@/lib/toast-context';
import { EstadoBadge } from '@/components/ui/badge';
import { EstadoOcBadge } from '@/components/purchase-orders/estado-oc-badge';
import { extractApiError, formatDate, formatMoney, formatNumber } from '@/lib/format';
import type { OrdenDeProveedor } from '@/types/proveedor';
import { DocumentosCompartidos } from '@/components/documents/documentos-compartidos';
import { RegistrarDespacho } from '@/components/portal/registrar-despacho';

// Detalle de solo lectura de una orden del proveedor externo.
export default function MiOrdenPage() {
  const { id } = useParams<{ id: string }>();
  const uid = useId();
  const toast = useToast();
  const [orden, setOrden] = useState<OrdenDeProveedor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fecha, setFecha] = useState('');
  const [confirmando, setConfirmando] = useState(false);

  const cargar = useCallback(() => {
    setError(null);
    api
      .get<OrdenDeProveedor>(`/purchase-orders/${id}`)
      .then((r) => setOrden(r.data))
      .catch((err) => setError(extractApiError(err, 'No se pudo cargar la orden.')));
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    setConfirmando(true);
    try {
      const r = await api.post<OrdenDeProveedor>(`/portal/ordenes/${id}/confirmar`, { fechaConfirmada: new Date(`${fecha}T12:00:00`).toISOString() });
      setOrden(r.data);
      toast.success('Orden confirmada. La empresa ya ve tu fecha de despacho.');
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo confirmar la orden.'));
    } finally {
      setConfirmando(false);
    }
  }

  if (error) {
    return (
      <div className="rounded-lg border border-navy/10 bg-white p-6 text-center">
        <p className="text-navy/70">{error}</p>
        <Button variant="ghost" className="mt-2" onClick={cargar}>Reintentar</Button>
        <Link href="/dashboard/mis-ordenes" className="mt-2 block text-sm text-sky hover:underline">Volver a mis órdenes</Link>
      </div>
    );
  }
  if (!orden) return <Skeleton className="h-64" />;

  return (
    <div>
      <Link href="/dashboard/mis-ordenes" className="text-sm text-sky hover:underline">← Mis órdenes</Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-navy">Orden {orden.numero}</h1>
        <EstadoOcBadge estado={orden.estado} />
      </div>

      {orden.estado === 'emitida' && (
        <Card className="mt-6">
          <CardTitle>Confirmar la orden</CardTitle>
          <p className="mt-1 text-sm text-navy/60">Indica la fecha en que te comprometes a despachar. La empresa recibe un aviso.</p>
          <form onSubmit={confirmar} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div>
              <label htmlFor={`${uid}-fecha`} className="mb-1 block text-sm font-medium text-navy">Fecha de despacho comprometida</label>
              <Input id={`${uid}-fecha`} type="date" required value={fecha} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <Button type="submit" disabled={confirmando || !fecha}>{confirmando ? 'Confirmando…' : 'Confirmar orden'}</Button>
          </form>
        </Card>
      )}

      {['confirmada', 'despachada', 'recibida_parcial'].includes(orden.estado) && <RegistrarDespacho orden={orden} onRegistrado={setOrden} />}

      <Card className="mt-6">
        <CardTitle>Datos de la orden</CardTitle>
        <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          {([
            ['Emitida', formatDate(orden.fechaEmision)],
            ['Requerida', formatDate(orden.fechaRequerida)],
            ['Fecha confirmada por ti', formatDate(orden.fechaConfirmadaProveedor)],
            ['Despachada', formatDate(orden.fechaDespacho)],
            ['Incoterm', orden.incoterm ?? '—'],
            ['Moneda', orden.moneda],
          ] as const).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-navy/5 py-1">
              <dt className="text-navy/60">{k}</dt>
              <dd className="font-medium text-navy">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card className="mt-6">
        <CardTitle>Productos</CardTitle>
        <div className="-mx-5 mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-y border-navy/5 bg-navy/[0.03] text-navy/60">
              <tr>
                <th scope="col" className="px-5 py-2 font-medium">Producto</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Pedido</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Recibido</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Precio</th>
                <th scope="col" className="px-5 py-2 font-medium">En camino</th>
              </tr>
            </thead>
            <tbody>
              {orden.lineas.map((l) => (
                <tr key={l.id} className="border-b border-navy/5 last:border-0 align-top">
                  <td className="px-5 py-3">
                    <span className="font-medium text-navy">{l.sku}</span>
                    <span className="block text-xs text-navy/50">{l.descripcion}</span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatNumber(l.cantidad)} <span className="text-navy/40">{l.unidad}</span></td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatNumber(l.cantidadRecibida)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{l.precioUnitario != null ? formatMoney(l.precioUnitario, orden.moneda) : '—'}</td>
                  <td className="px-5 py-3">
                    {l.embarques.length === 0 ? (
                      <span className="text-navy/40">Sin embarque</span>
                    ) : (
                      <ul className="space-y-1">
                        {l.embarques.map((e) => (
                          <li key={e.shipment.codigoGuia} className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-navy">{e.shipment.codigoGuia}</span>
                            <EstadoBadge estado={e.shipment.estado} />
                            <span className="text-xs text-navy/60">{formatNumber(e.cantidad)} · llega {formatDate(e.shipment.fechaEstimadaLlegada)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {[...new Map(orden.lineas.flatMap((l) => l.embarques.map((e) => [e.shipment.id, e.shipment.codigoGuia] as const))).entries()].map(([shipmentId, guia]) => (
        <DocumentosCompartidos key={shipmentId} shipmentId={shipmentId} modo="proveedor" titulo={`Documentos del envío ${guia}`} />
      ))}

      <Conversacion tipo="orden_compra" id={orden.id} titulo="Mensajes con la empresa" ayuda="Aclara plazos, cantidades o cualquier novedad de esta orden." />
    </div>
  );
}
