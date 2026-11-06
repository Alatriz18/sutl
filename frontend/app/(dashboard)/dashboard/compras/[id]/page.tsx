'use client';

import { FormEvent, useCallback, useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertTriangle, Check, Truck } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EstadoOcBadge } from '@/components/purchase-orders/estado-oc-badge';
import { EstadoBadge } from '@/components/ui/badge';
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
  cantidadAsignada,
  cantidadEnCamino,
  porAsignar,
  fechaInputAIso,
  isoAFechaInput,
  maximoRecepcion,
  pendiente,
  totalOc,
} from '@/lib/purchase-orders';
import { useTenantConfig } from '@/lib/tenant-config';
import { PurchaseOrder, Shipment, Warehouse } from '@/types';

const ESTADOS_VINCULO = ['emitida', 'confirmada', 'despachada', 'recibida_parcial'];

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
  const [ingresarInventario, setIngresarInventario] = useState(false);
  const [bodegaId, setBodegaId] = useState('');
  const [bodegas, setBodegas] = useState<Warehouse[]>([]);
  const [envios, setEnvios] = useState<Shipment[]>([]);
  const [embarqueId, setEmbarqueId] = useState('');
  const [asignacion, setAsignacion] = useState<Record<string, string>>({});
  const { config } = useTenantConfig();
  const modoInventario = config.inventario.recepcionActualizaInventario;
  const tolerancia = config.compras.toleranciaSobreRecepcionPct;
  const mueveInventario = modoInventario === 'automatico' || (modoInventario === 'a_eleccion' && ingresarInventario);

  const aplicar = useCallback((data: PurchaseOrder) => {
    setOc(data);
    setFechaConfirmada(isoAFechaInput(data.fechaConfirmadaProveedor));
    setRecepcion({});
    setNotasRecepcion('');
    setIngresarInventario(false);
    setEmbarqueId('');
    setAsignacion({});
  }, []);

  useEffect(() => {
    api
      .get<PurchaseOrder>(`/purchase-orders/${id}`)
      .then((res) => aplicar(res.data))
      .catch(() => setNotFound(true));
  }, [id, aplicar]);

  // Bodegas solo si la configuración de la empresa permite ingresar al inventario.
  useEffect(() => {
    if (modoInventario === 'nunca') return;
    api
      .get<Warehouse[]>('/warehouses')
      .then((res) => {
        const activas = res.data.filter((w) => w.activo);
        setBodegas(activas);
        setBodegaId((actual) => actual || (activas.length === 1 ? activas[0].id : ''));
      })
      .catch(() => setBodegas([]));
  }, [modoInventario]);

  // Embarques que aún admiten carga, solo si la OC permite vincularlos.
  const puedeVincular = !!oc && ESTADOS_VINCULO.includes(oc.estado);
  useEffect(() => {
    if (!puedeVincular) return;
    api
      .get<Shipment[]>('/shipments')
      .then((res) => setEnvios(res.data.filter((e) => e.estado !== 'entregado')))
      .catch(() => setEnvios([]));
  }, [puedeVincular]);

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
      fechaConfirmada
        ? { estado: 'confirmada', fechaConfirmadaProveedor: fechaInputAIso(fechaConfirmada) }
        : { estado: 'confirmada' },
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

  // Al elegir un embarque se precarga lo ya asignado a él, o lo que falta por asignar.
  function elegirEmbarque(shipmentId: string) {
    setEmbarqueId(shipmentId);
    if (!oc || !shipmentId) {
      setAsignacion({});
      return;
    }
    const inicial: Record<string, string> = {};
    for (const l of oc.lineas) {
      const actual = (l.embarques ?? []).find((x) => x.shipment.id === shipmentId)?.cantidad;
      const sugerido = actual ?? porAsignar(l, tolerancia);
      inicial[l.id] = sugerido > 0 ? String(sugerido) : '';
    }
    setAsignacion(inicial);
  }

  async function handleVincular(e: FormEvent) {
    e.preventDefault();
    if (!oc || !embarqueId) return;
    const lineas = oc.lineas.flatMap((l) => {
      const actual = (l.embarques ?? []).find((x) => x.shipment.id === embarqueId)?.cantidad ?? 0;
      const nueva = Number(asignacion[l.id] ?? '') || 0;
      // Una línea en blanco que antes tenía carga en este embarque la quita (cantidad 0).
      return nueva > 0 || actual > 0 ? [{ lineaId: l.id, cantidad: nueva }] : [];
    });
    if (lineas.length === 0) {
      toast.error('Indica la cantidad de al menos una línea que viaja en este embarque.');
      return;
    }
    await ejecutar(
      () => api.post<PurchaseOrder>(`/purchase-orders/${id}/embarques`, { shipmentId: embarqueId, lineas }),
      'Embarque vinculado.',
      'No se pudo vincular el embarque.',
    );
  }

  async function handleDesvincular(shipmentId: string) {
    await ejecutar(
      () => api.delete<PurchaseOrder>(`/purchase-orders/${id}/embarques/${shipmentId}`),
      'Carga quitada del embarque.',
      'No se pudo quitar la carga del embarque.',
    );
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
    if (mueveInventario && !bodegaId) {
      toast.error('Elige la bodega a la que entra lo recibido.');
      return;
    }
    await ejecutar(
      () =>
        api.post<PurchaseOrder>(`/purchase-orders/${id}/recepciones`, {
          lineas,
          notas: notasRecepcion.trim() || undefined,
          ...(modoInventario === 'a_eleccion' ? { actualizarInventario: ingresarInventario } : {}),
          ...(mueveInventario ? { warehouseId: bodegaId } : {}),
        }),
      mueveInventario ? 'Recepción registrada e ingresada al inventario.' : 'Recepción registrada.',
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

  const alerta = alertaFecha(oc, config.compras.diasAlertaAnticipada);
  const avance = avanceRecepcion(oc);
  const siguientes = TRANSICIONES_OC[oc.estado];
  const puedeRecibir = ESTADOS_RECEPCION_OC.includes(oc.estado);
  const cerrada = oc.estado === 'recibida' || oc.estado === 'cancelada';
  // Carga agrupada por embarque para mostrarla como una lista de embarques.
  const embarquesVinculados = Object.values(
    oc.lineas
      .flatMap((l) => (l.embarques ?? []).map((e) => ({ ...e, sku: l.sku, unidad: l.unidad })))
      .reduce<Record<string, { shipment: NonNullable<typeof oc.lineas[number]['embarques']>[number]['shipment']; lineas: { sku: string; unidad: string; cantidad: number }[] }>>(
        (acc, e) => {
          (acc[e.shipment.id] ??= { shipment: e.shipment, lineas: [] }).lineas.push({ sku: e.sku, unidad: e.unidad, cantidad: e.cantidad });
          return acc;
        },
        {},
      ),
  );
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
                    <th className="px-3 py-2 text-right font-medium">En camino</th>
                    <th className="px-3 py-2 text-right font-medium">Subtotal</th>
                    {puedeRecibir && <th className="px-5 py-2 font-medium">Recibir ahora</th>}
                  </tr>
                </thead>
                <tbody>
                  {oc.lineas.map((l) => {
                    const falta = pendiente(l);
                    const maximo = maximoRecepcion(l, tolerancia);
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
                        <td className="px-3 py-3 text-right tabular-nums text-navy/70">
                          {cantidadEnCamino(l) > 0 ? formatNumber(cantidadEnCamino(l)) : '—'}
                        </td>
                        {puedeRecibir && (
                          <td className="px-5 py-3">
                            {falta > 0 && (
                              <Input
                                type="number"
                                min="0"
                                max={maximo}
                                step="any"
                                aria-label={`Cantidad recibida de ${l.sku}`}
                                placeholder={`máx. ${formatNumber(maximo)}`}
                                className="w-28"
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
              <div className="mt-4 flex flex-col gap-3 rounded-lg bg-sky/5 p-3">
                <InventarioRecepcion
                  formId={formId}
                  modo={modoInventario}
                  ingresar={ingresarInventario}
                  onIngresar={setIngresarInventario}
                  bodegas={bodegas}
                  bodegaId={bodegaId}
                  onBodega={setBodegaId}
                />
                {tolerancia > 0 && (
                  <p className="text-xs text-navy/60">
                    Tu empresa acepta recibir hasta un {formatNumber(tolerancia)}% más de lo pedido en cada línea.
                  </p>
                )}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
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
                      {!config.compras.exigirFechaConfirmacion && (
                        <span className="font-normal text-navy/50"> (opcional)</span>
                      )}
                    </label>
                    <Input
                      id={`${formId}-fconf`}
                      type="date"
                      required={config.compras.exigirFechaConfirmacion}
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

      <Card className="mt-6">
        <div className="flex items-center gap-2">
          <Truck size={18} className="text-sky" aria-hidden />
          <CardTitle>Embarques</CardTitle>
        </div>
        <p className="mt-1 text-sm text-navy/60">
          Qué parte de cada línea viaja en cada embarque. La llegada prevista de los embarques alimenta la alerta de fecha.
        </p>
        {embarquesVinculados.length === 0 ? (
          <p className="mt-3 text-sm text-navy/50">Todavía no se asignó carga de esta OC a ningún embarque.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {embarquesVinculados.map((g) => (
              <li key={g.shipment.id} className="rounded-lg border border-navy/10 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/dashboard/shipments/${g.shipment.id}`} className="font-semibold text-sky hover:underline">
                      {g.shipment.codigoGuia}
                    </Link>
                    <EstadoBadge estado={g.shipment.estado} />
                    <span className="text-navy/60">
                      Llegada prevista: {g.shipment.fechaEstimadaLlegada ? formatDate(g.shipment.fechaEstimadaLlegada) : 'sin fecha'}
                    </span>
                  </div>
                  {puedeVincular && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleDesvincular(g.shipment.id)}
                      className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                      aria-label={`Quitar la carga de esta OC del embarque ${g.shipment.codigoGuia}`}
                    >
                      Quitar
                    </button>
                  )}
                </div>
                <ul className="mt-2 text-navy/70">
                  {g.lineas.map((l) => (
                    <li key={l.sku}>
                      <strong className="text-navy">{formatNumber(l.cantidad)}</strong> {l.unidad} de {l.sku}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}

        {puedeVincular && (
          <form onSubmit={handleVincular} className="mt-4 border-t border-navy/5 pt-4">
            <label htmlFor={`${formId}-embarque`} className="mb-1 block text-sm font-medium text-navy">
              Vincular un embarque
            </label>
            <select
              id={`${formId}-embarque`}
              value={embarqueId}
              onChange={(e) => elegirEmbarque(e.target.value)}
              className="w-full max-w-xl rounded-md border border-navy/20 bg-white px-3 py-2 text-sm"
            >
              <option value="">Elige un embarque</option>
              {envios.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.codigoGuia} · {e.origen} → {e.destino}
                </option>
              ))}
            </select>
            {envios.length === 0 && (
              <p className="mt-1 text-xs text-navy/50">
                No hay embarques activos. <Link href="/dashboard/shipments/nuevo" className="text-sky hover:underline">Crea uno</Link> y vuelve.
              </p>
            )}
            {embarqueId && (
              <div className="mt-3">
                <p className="mb-2 text-xs text-navy/60">Cantidad de cada línea que viaja en este embarque (deja en blanco las que no).</p>
                <div className="space-y-2">
                  {oc.lineas.map((l) => (
                    <div key={l.id} className="flex flex-wrap items-center gap-3 text-sm">
                      <span className="w-40 font-medium text-navy">{l.sku}</span>
                      <span className="w-52 text-xs text-navy/50">
                        Pedido {formatNumber(l.cantidad)} · asignado {formatNumber(cantidadAsignada(l))} {l.unidad}
                      </span>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        className="w-36"
                        aria-label={`Cantidad de ${l.sku} en este embarque`}
                        value={asignacion[l.id] ?? ''}
                        onChange={(e) => setAsignacion((a) => ({ ...a, [l.id]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
                <Button type="submit" className="mt-3" disabled={busy}>
                  Guardar vínculo
                </Button>
              </div>
            )}
          </form>
        )}
      </Card>

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
                  {r.warehouse && <span className="text-navy/60"> → {r.warehouse.nombre}</span>}
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

// Qué pasa con el inventario al recibir, según la configuración de la empresa.
function InventarioRecepcion({
  formId,
  modo,
  ingresar,
  onIngresar,
  bodegas,
  bodegaId,
  onBodega,
}: {
  formId: string;
  modo: 'automatico' | 'a_eleccion' | 'nunca';
  ingresar: boolean;
  onIngresar: (v: boolean) => void;
  bodegas: Warehouse[];
  bodegaId: string;
  onBodega: (id: string) => void;
}) {
  if (modo === 'nunca') {
    return (
      <p className="text-xs text-navy/60">
        Tu empresa lleva el inventario en su propio sistema: esta recepción no mueve stock en SUTL.
      </p>
    );
  }
  const mostrarBodega = modo === 'automatico' || ingresar;
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-4">
      {modo === 'a_eleccion' && (
        <label className="flex items-center gap-2 text-sm font-medium text-navy sm:pb-2">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-navy/30 text-sky focus:ring-sky"
            checked={ingresar}
            onChange={(e) => onIngresar(e.target.checked)}
          />
          Ingresar lo recibido al inventario
        </label>
      )}
      {mostrarBodega && (
        <div className="flex-1">
          <label htmlFor={`${formId}-bodega`} className="mb-1 block text-sm font-medium text-navy">
            Bodega de destino
          </label>
          {bodegas.length === 0 ? (
            <p className="text-xs text-navy/60">
              No hay bodegas activas.{' '}
              <Link href="/dashboard/almacen" className="text-sky hover:underline">
                Crea una en Almacén
              </Link>
              .
            </p>
          ) : (
            <select
              id={`${formId}-bodega`}
              required
              value={bodegaId}
              onChange={(e) => onBodega(e.target.value)}
              className="w-full rounded-md border border-navy/20 bg-white px-3 py-2 text-sm"
            >
              <option value="">Elige una bodega</option>
              {bodegas.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
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
