'use client';

import { FormEvent, useCallback, useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertTriangle, Check } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EstadoOcBadge } from '@/components/purchase-orders/estado-oc-badge';
import { ProgressBar } from '@/components/purchase-orders/progress-bar';
import { useToast } from '@/lib/toast-context';
import { cn } from '@/lib/utils';
import { extractApiError, formatDate, formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import {
  ESTADOS_RECEPCION_OC,
  ESTADO_OC_LABELS,
  FLUJO_OC,
  TRANSICIONES_OC,
  alertaFecha,
  avanceRecepcion,
  fechaInputAIso,
  isoAFechaInput,
  pendiente,
  totalOc,
} from '@/lib/purchase-orders';
import { PurchaseOrder } from '@/types';

export default function OrdenCompraDetallePage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const formId = useId();
  const [oc, setOc] = useState<PurchaseOrder | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fechaConfirmada, setFechaConfirmada] = useState('');
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [recepcion, setRecepcion] = useState<Record<string, string>>({});
  const [notasRecepcion, setNotasRecepcion] = useState('');

  const aplicar = useCallback((data: PurchaseOrder) => {
    setOc(data);
    setFechaConfirmada(isoAFechaInput(data.fechaConfirmadaProveedor));
    setRecepcion({});
    setNotasRecepcion('');
  }, []);

  useEffect(() => {
    api
      .get<PurchaseOrder>(`/purchase-orders/${id}`)
      .then((res) => aplicar(res.data))
      .catch(() => setNotFound(true));
  }, [id, aplicar]);

  async function ejecutar(fn: () => Promise<{ data: PurchaseOrder }>, exito: string, fallo: string) {
    setBusy(true);
    try {
      const res = await fn();
      aplicar(res.data);
      toast.success(exito);
      return true;
    } catch (err) {
      toast.error(extractApiError(err, fallo));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const transicion = (body: Record<string, string>, exito: string) =>
    ejecutar(() => api.post<PurchaseOrder>(`/purchase-orders/${id}/transicion`, body), exito, 'No se pudo cambiar el estado.');

  async function handleConfirmar(e: FormEvent) {
    e.preventDefault();
    await transicion(
      { estado: 'confirmada', fechaConfirmadaProveedor: fechaInputAIso(fechaConfirmada) },
      'OC confirmada por el proveedor.',
    );
  }

  async function handleActualizarFecha(e: FormEvent) {
    e.preventDefault();
    await ejecutar(
      () =>
        api.patch<PurchaseOrder>(`/purchase-orders/${id}`, {
          fechaConfirmadaProveedor: fechaInputAIso(fechaConfirmada),
        }),
      'Fecha del proveedor actualizada.',
      'No se pudo actualizar la fecha.',
    );
  }

  async function handleCancelar(e: FormEvent) {
    e.preventDefault();
    const okCancel = await transicion({ estado: 'cancelada', motivo: motivo.trim() }, 'OC cancelada.');
    if (okCancel) {
      setCancelando(false);
      setMotivo('');
    }
  }

  async function handleRecepcion(e: FormEvent) {
    e.preventDefault();
    const lineas = Object.entries(recepcion)
      .filter(([, v]) => v !== '' && Number(v) > 0)
      .map(([lineaId, v]) => ({ lineaId, cantidad: Number(v) }));
    if (lineas.length === 0) {
      toast.error('Indica la cantidad recibida en al menos una línea.');
      return;
    }
    await ejecutar(
      () =>
        api.post<PurchaseOrder>(`/purchase-orders/${id}/recepciones`, {
          lineas,
          notas: notasRecepcion.trim() || undefined,
        }),
      'Recepción registrada.',
      'No se pudo registrar la recepción.',
    );
  }

  if (notFound) {
    return (
      <div className="rounded-lg border border-navy/10 bg-white p-6 text-center">
        <p className="text-navy/70">No se encontró esta orden de compra.</p>
        <Link href="/dashboard/compras" className="mt-2 inline-block text-sm text-sky hover:underline">
          ← Volver a órdenes de compra
        </Link>
      </div>
    );
  }

  if (!oc) {
    return (
      <div>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-2 h-4 w-96" />
        <Skeleton className="mt-6 h-16" />
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const alerta = alertaFecha(oc);
  const avance = avanceRecepcion(oc);
  const siguientes = TRANSICIONES_OC[oc.estado];
  const puedeRecibir = ESTADOS_RECEPCION_OC.includes(oc.estado);
  const cerrada = oc.estado === 'recibida' || oc.estado === 'cancelada';
  const historial = oc.lineas
    .flatMap((l) => (l.recepciones ?? []).map((r) => ({ ...r, sku: l.sku, unidad: l.unidad })))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <div>
      <Link href="/dashboard/compras" className="text-sm text-sky hover:underline">
        ← Órdenes de compra
      </Link>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">{oc.numero}</h1>
          <p className="text-navy/60">
            {oc.proveedor?.nombre ?? '—'}
            {oc.incoterm ? ` · ${oc.incoterm}` : ''} · {oc.moneda}
          </p>
        </div>
        <EstadoOcBadge estado={oc.estado} />
      </div>

      {alerta && (
        <div
          role="status"
          className={cn(
            'mt-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm',
            alerta.nivel === 'rojo'
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-gold/40 bg-gold/10 text-[#8A5A12]',
          )}
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          {alerta.texto}
        </div>
      )}

      <Timeline oc={oc} />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between gap-4">
            <CardTitle>Líneas</CardTitle>
            <div className="flex w-48 items-center gap-2">
              <ProgressBar value={avance} label="Avance de recepción de la OC" />
              <span className="text-xs tabular-nums text-navy/60">{Math.round(avance * 100)}%</span>
            </div>
          </div>
          <form id={`${formId}-recepcion`} onSubmit={handleRecepcion}>
            <div className="-mx-5 mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-y border-navy/5 bg-navy/[0.03] text-navy/60">
                  <tr>
                    <th className="px-5 py-2 font-medium">SKU</th>
                    <th className="px-3 py-2 text-right font-medium">Pedido</th>
                    <th className="px-3 py-2 text-right font-medium">Recibido</th>
                    <th className="px-3 py-2 text-right font-medium">Pendiente</th>
                    <th className="px-3 py-2 text-right font-medium">Subtotal</th>
                    {puedeRecibir && <th className="px-5 py-2 font-medium">Recibir ahora</th>}
                  </tr>
                </thead>
                <tbody>
                  {oc.lineas.map((l) => {
                    const falta = pendiente(l);
                    return (
                      <tr key={l.id} className="border-b border-navy/5 last:border-0">
                        <td className="px-5 py-3">
                          <p className="font-medium text-navy">{l.sku}</p>
                          <p className="text-xs text-navy/50">{l.descripcion}</p>
                          <ProgressBar
                            className="mt-1.5 max-w-[160px]"
                            value={l.cantidadRecibida / l.cantidad}
                            label={`Recepción de ${l.sku}`}
                          />
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {formatNumber(l.cantidad)} <span className="text-navy/40">{l.unidad}</span>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">{formatNumber(l.cantidadRecibida)}</td>
                        <td className={cn('px-3 py-3 text-right tabular-nums', falta > 0 ? 'font-medium text-navy' : 'text-emerald-700')}>
                          {falta > 0 ? formatNumber(falta) : <Check size={16} className="ml-auto" aria-label="Completa" />}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-navy/70">
                          {l.precioUnitario == null ? '—' : formatMoney(l.cantidad * l.precioUnitario, oc.moneda)}
                        </td>
                        {puedeRecibir && (
                          <td className="px-5 py-3">
                            {falta > 0 && (
                              <Input
                                type="number"
                                min="0"
                                max={falta}
                                step="any"
                                aria-label={`Cantidad recibida de ${l.sku}`}
                                placeholder={`máx. ${formatNumber(falta)}`}
                                className="w-32"
                                value={recepcion[l.id] ?? ''}
                                onChange={(e) => setRecepcion((r) => ({ ...r, [l.id]: e.target.value }))}
                              />
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-navy/5 pt-3 text-sm">
              <span className="text-navy/60">Total OC</span>
              <span className="font-semibold text-navy">{formatMoney(totalOc(oc), oc.moneda)}</span>
            </div>
            {puedeRecibir && (
              <div className="mt-4 flex flex-col gap-3 rounded-lg bg-sky/5 p-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label htmlFor={`${formId}-notas-rec`} className="mb-1 block text-sm font-medium text-navy">
                    Nota de recepción (opcional)
                  </label>
                  <Input
                    id={`${formId}-notas-rec`}
                    maxLength={1000}
                    placeholder="Ej. Contenedor MSKU1234567, guía de remisión 001-0045"
                    value={notasRecepcion}
                    onChange={(e) => setNotasRecepcion(e.target.value)}
                  />
                </div>
                <Button type="submit" variant="secondary" disabled={busy}>
                  Registrar recepción
                </Button>
              </div>
            )}
          </form>
        </Card>

        <div className="flex flex-col gap-6">
          {!cerrada && (
            <Card>
              <CardTitle>Siguiente paso</CardTitle>
              <div className="mt-3 flex flex-col gap-3 text-sm">
                {siguientes.includes('emitida') && (
                  <>
                    <p className="text-navy/60">Revisa las líneas y emite la OC al proveedor. Después ya no se podrán editar.</p>
                    <Button disabled={busy} onClick={() => transicion({ estado: 'emitida' }, 'OC emitida.')}>
                      Emitir OC
                    </Button>
                  </>
                )}
                {siguientes.includes('confirmada') && (
                  <form onSubmit={handleConfirmar} className="flex flex-col gap-2">
                    <label htmlFor={`${formId}-fconf`} className="font-medium text-navy">
                      Fecha de despacho comprometida por el proveedor
                    </label>
                    <Input
                      id={`${formId}-fconf`}
                      type="date"
                      required
                      value={fechaConfirmada}
                      onChange={(e) => setFechaConfirmada(e.target.value)}
                    />
                    <Button type="submit" disabled={busy}>
                      Registrar confirmación
                    </Button>
                  </form>
                )}
                {siguientes.includes('despachada') && (
                  <>
                    <p className="text-navy/60">
                      Cuando el proveedor entregue la carga al transportista, márcala como despachada. Si es un proveedor
                      local puedes registrar la recepción directamente.
                    </p>
                    <Button disabled={busy} onClick={() => transicion({ estado: 'despachada' }, 'OC marcada como despachada.')}>
                      Marcar despachada
                    </Button>
                  </>
                )}
                {puedeRecibir && siguientes.length === 0 && (
                  <p className="text-navy/60">Registra lo que va llegando en la tabla de líneas. La OC se cierra sola al recibir todo.</p>
                )}
                {siguientes.includes('cancelada') &&
                  (cancelando ? (
                    <form onSubmit={handleCancelar} className="mt-2 flex flex-col gap-2 border-t border-navy/5 pt-3">
                      <label htmlFor={`${formId}-motivo`} className="font-medium text-navy">
                        Motivo de la cancelación
                      </label>
                      <Input
                        id={`${formId}-motivo`}
                        required
                        maxLength={500}
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button type="submit" variant="danger" disabled={busy || !motivo.trim()}>
                          Cancelar OC
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => setCancelando(false)}>
                          Volver
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <button
                      type="button"
                      className="self-start text-xs font-medium text-red-600 hover:underline"
                      onClick={() => setCancelando(true)}
                    >
                      Cancelar esta OC
                    </button>
                  ))}
              </div>
            </Card>
          )}

          <Card>
            <CardTitle>Fechas</CardTitle>
            <dl className="mt-3 space-y-1 text-sm">
              <Row label="Emisión" value={formatDate(oc.fechaEmision)} />
              <Row label="Requerida en planta" value={formatDate(oc.fechaRequerida)} />
              <Row label="Confirmada proveedor" value={formatDate(oc.fechaConfirmadaProveedor)} />
              <Row label="Despacho" value={formatDate(oc.fechaDespacho)} />
            </dl>
            {!cerrada && oc.fechaConfirmadaProveedor && (
              <form onSubmit={handleActualizarFecha} className="mt-3 flex flex-col gap-2 border-t border-navy/5 pt-3 text-sm">
                <label htmlFor={`${formId}-fnueva`} className="font-medium text-navy">
                  ¿El proveedor movió su fecha?
                </label>
                <div className="flex gap-2">
                  <Input
                    id={`${formId}-fnueva`}
                    type="date"
                    required
                    value={fechaConfirmada}
                    onChange={(e) => setFechaConfirmada(e.target.value)}
                  />
                  <Button
                    type="submit"
                    variant="ghost"
                    disabled={busy || fechaConfirmada === isoAFechaInput(oc.fechaConfirmadaProveedor)}
                  >
                    Guardar
                  </Button>
                </div>
              </form>
            )}
          </Card>

          <Card>
            <CardTitle>Proveedor</CardTitle>
            <dl className="mt-3 space-y-1 text-sm">
              <Row label="Nombre" value={oc.proveedor?.nombre ?? '—'} />
              <Row label="RUC / Tax ID" value={oc.proveedor?.taxId ?? '—'} />
              <Row label="Contacto" value={oc.proveedor?.contactoNombre ?? '—'} />
              <Row label="Email" value={oc.proveedor?.email ?? '—'} />
            </dl>
            {oc.notas && <p className="mt-3 rounded-md bg-navy/[0.03] p-3 text-sm text-navy/70">{oc.notas}</p>}
            {oc.motivoCancelacion && (
              <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-800">
                <strong>Motivo de cancelación:</strong> {oc.motivoCancelacion}
              </p>
            )}
          </Card>
        </div>
      </div>

      <div className="mt-6">
        <CardTitle className="mb-3">Historial de recepciones</CardTitle>
        {historial.length === 0 ? (
          <p className="text-sm text-navy/50">Todavía no se ha recibido mercadería de esta OC.</p>
        ) : (
          <ol className="space-y-2">
            {historial.map((r) => (
              <li key={r.id} className="flex flex-col gap-1 rounded-lg border border-navy/10 bg-white p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span>
                  <strong className="text-navy">
                    {formatNumber(r.cantidad)} {r.unidad}
                  </strong>{' '}
                  <span className="text-navy/60">de {r.sku}</span>
                  {r.notas && <span className="text-navy/50"> · {r.notas}</span>}
                </span>
                <span className="text-xs text-navy/50">{formatDateTime(r.fecha)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function Timeline({ oc }: { oc: PurchaseOrder }) {
  if (oc.estado === 'cancelada') return null;
  const actual = oc.estado === 'recibida_parcial' ? FLUJO_OC.indexOf('despachada') : FLUJO_OC.indexOf(oc.estado);
  return (
    <ol className="mt-6 grid grid-cols-5 gap-1" aria-label="Avance de la OC">
      {FLUJO_OC.map((estado, i) => {
        const hecho = i <= actual;
        const esParcial = estado === 'recibida' && oc.estado === 'recibida_parcial';
        return (
          <li key={estado} aria-current={i === actual ? 'step' : undefined}>
            <div
              className={cn(
                'h-1.5 rounded-full',
                hecho ? 'bg-sky' : esParcial ? 'bg-gradient-to-r from-gold to-navy/10' : 'bg-navy/10',
              )}
            />
            <p className={cn('mt-1.5 text-[11px] sm:text-xs', hecho ? 'font-semibold text-navy' : 'text-navy/45')}>
              {esParcial ? ESTADO_OC_LABELS.recibida_parcial : ESTADO_OC_LABELS[estado]}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-navy/5 py-1.5 last:border-0">
      <dt className="text-navy/60">{label}</dt>
      <dd className="text-right font-medium text-navy">{value}</dd>
    </div>
  );
}
