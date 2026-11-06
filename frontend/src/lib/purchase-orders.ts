import { EmbarqueDeLinea, EstadoOrdenCompra, PurchaseOrder, PurchaseOrderLine } from '@/types';

export const ESTADO_OC_LABELS: Record<EstadoOrdenCompra, string> = {
  borrador: 'Borrador',
  emitida: 'Emitida',
  confirmada: 'Confirmada',
  despachada: 'Despachada',
  recibida_parcial: 'Recibida parcial',
  recibida: 'Recibida',
  cancelada: 'Cancelada',
};

export const ESTADO_OC_STYLES: Record<EstadoOrdenCompra, string> = {
  borrador: 'bg-slate-100 text-slate-700',
  emitida: 'bg-navy/10 text-navy',
  confirmada: 'bg-sky/10 text-sky',
  despachada: 'bg-indigo-100 text-indigo-700',
  recibida_parcial: 'bg-gold/15 text-[#8A5A12]',
  recibida: 'bg-emerald-100 text-emerald-700',
  cancelada: 'bg-red-100 text-red-700',
};

// Orden del flujo normal, usado para la línea de tiempo del detalle.
export const FLUJO_OC: EstadoOrdenCompra[] = ['borrador', 'emitida', 'confirmada', 'despachada', 'recibida'];

// Mismas reglas que TRANSICIONES en backend/src/modules/purchase-orders.
export const TRANSICIONES_OC: Record<EstadoOrdenCompra, EstadoOrdenCompra[]> = {
  borrador: ['emitida', 'cancelada'],
  emitida: ['confirmada', 'cancelada'],
  confirmada: ['despachada', 'cancelada'],
  despachada: [],
  recibida_parcial: [],
  recibida: [],
  cancelada: [],
};

export const ESTADOS_RECEPCION_OC: EstadoOrdenCompra[] = ['confirmada', 'despachada', 'recibida_parcial'];

export const INCOTERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'] as const;

export function pendiente(linea: Pick<PurchaseOrderLine, 'cantidad' | 'cantidadRecibida'>) {
  return Math.max(linea.cantidad - linea.cantidadRecibida, 0);
}

// Máximo que se puede recibir ahora en la línea, con la tolerancia de
// sobre-recepción que configuró la empresa (mismo cálculo que el backend).
export function maximoRecepcion(
  linea: Pick<PurchaseOrderLine, 'cantidad' | 'cantidadRecibida'>,
  toleranciaPct: number,
) {
  const limite = linea.cantidad * (1 + toleranciaPct / 100) - linea.cantidadRecibida;
  return Math.max(Math.round(limite * 10000) / 10000, 0);
}

type ConEmbarques = Pick<PurchaseOrderLine, 'cantidad' | 'cantidadRecibida'> & { embarques?: EmbarqueDeLinea[] };

const redondear = (n: number) => Math.round(n * 10000) / 10000;

// Cantidad de la línea ya asignada a algún embarque (entregado o no).
export function cantidadAsignada(linea: ConEmbarques) {
  return redondear((linea.embarques ?? []).reduce((s, e) => s + e.cantidad, 0));
}

// Lo que viaja ahora mismo: asignado a embarques que aún no se entregan, sin
// pasar de lo que falta recibir (lo ya entregado y recibido no está «en camino»).
export function cantidadEnCamino(linea: ConEmbarques) {
  const enRuta = (linea.embarques ?? []).filter((e) => e.shipment.estado !== 'entregado');
  return redondear(Math.min(enRuta.reduce((s, e) => s + e.cantidad, 0), pendiente(linea)));
}

// Lo que todavía se puede asignar a embarques, con la tolerancia de sobre-recepción
// que acepta la empresa (mismo cálculo que el backend).
export function porAsignar(linea: ConEmbarques, toleranciaPct: number) {
  return Math.max(redondear(linea.cantidad * (1 + toleranciaPct / 100) - cantidadAsignada(linea)), 0);
}

// Llegada más tardía entre los embarques en ruta que traen carga pendiente de
// esta OC: es lo que realmente determina cuándo estará completa.
export function etaMasTardia(oc: { lineas?: ConEmbarques[] }): { eta: number; codigoGuia: string } | null {
  let peor: { eta: number; codigoGuia: string } | null = null;
  for (const l of oc.lineas ?? []) {
    if (pendiente(l) <= 0) continue;
    for (const e of l.embarques ?? []) {
      if (e.shipment.estado === 'entregado' || !e.shipment.fechaEstimadaLlegada) continue;
      const eta = new Date(e.shipment.fechaEstimadaLlegada).getTime();
      if (!peor || eta > peor.eta) peor = { eta, codigoGuia: e.shipment.codigoGuia };
    }
  }
  return peor;
}

// Avance de recepción de toda la OC, de 0 a 1 (promedio por línea, para que
// una línea en kg no pese más que otra en unidades).
export function avanceRecepcion(oc: Pick<PurchaseOrder, 'lineas'>) {
  if (oc.lineas.length === 0) return 0;
  const suma = oc.lineas.reduce((acc, l) => acc + Math.min(l.cantidadRecibida / l.cantidad, 1), 0);
  return suma / oc.lineas.length;
}

export function totalOc(oc: Pick<PurchaseOrder, 'lineas'>) {
  if (oc.lineas.some((l) => l.precioUnitario == null)) return null;
  return oc.lineas.reduce((acc, l) => acc + l.cantidad * (l.precioUnitario ?? 0), 0);
}

export type AlertaFechaOc = { nivel: 'rojo' | 'ambar'; texto: string } | null;

// Señal temprana simple (no es el motor de riesgo completo): compara lo que
// la planta necesita con lo que el proveedor prometió. diasAlerta viene de la
// configuración de la empresa (compras.diasAlertaAnticipada).
export function alertaFecha(
  oc: Pick<PurchaseOrder, 'estado' | 'fechaRequerida' | 'fechaConfirmadaProveedor'> & { lineas?: ConEmbarques[] },
  diasAlerta = 7,
  ahora = Date.now(),
): AlertaFechaOc {
  if (oc.estado === 'recibida' || oc.estado === 'cancelada' || !oc.fechaRequerida) return null;
  const requerida = new Date(oc.fechaRequerida).getTime();
  if (requerida < ahora) {
    return { nivel: 'rojo', texto: 'Vencida: la fecha requerida ya pasó sin recepción completa' };
  }
  // La llegada prevista de un embarque real pesa más que la promesa del proveedor.
  const tardia = etaMasTardia(oc);
  if (tardia) {
    const dias = Math.round((tardia.eta - requerida) / 86400000);
    if (dias > 0) {
      return { nivel: 'rojo', texto: `El embarque ${tardia.codigoGuia} llega ${dias} día${dias === 1 ? '' : 's'} después de la fecha requerida` };
    }
  }
  if (oc.fechaConfirmadaProveedor) {
    const dias = Math.round((new Date(oc.fechaConfirmadaProveedor).getTime() - requerida) / 86400000);
    if (dias > 0) {
      return { nivel: 'rojo', texto: `El proveedor despacha ${dias} día${dias === 1 ? '' : 's'} después de la fecha requerida` };
    }
  }
  const diasRestantes = Math.ceil((requerida - ahora) / 86400000);
  if (diasRestantes <= diasAlerta && ['borrador', 'emitida'].includes(oc.estado)) {
    return { nivel: 'ambar', texto: `Faltan ${diasRestantes} días y el proveedor aún no confirma` };
  }
  return null;
}

// Un <input type="date"> da 'YYYY-MM-DD'. Enviarlo tal cual lo interpreta como
// medianoche UTC, que en Ecuador (UTC-5) se muestra como el día anterior; se
// fija al mediodía local para que la fecha no se corra.
export function fechaInputAIso(fecha: string) {
  return new Date(`${fecha}T12:00:00`).toISOString();
}

export function isoAFechaInput(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
