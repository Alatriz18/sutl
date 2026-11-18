import type { PurchaseOrder } from '@/types';
import type { AnaliticaResumen } from '@/types/analitica';
import * as db from './data';
import { MockApiError } from './errors';
import { configEfectivaDemo } from './tenant-config';
import { ESTADOS_ABIERTOS, OcAnalitica, aging, puntualidadEnvios, resumenAnalitica, tendenciaMensual } from './analytics-engine';

// Analítica del modo demo: misma lógica que el backend (copia del motor) sobre las OC de muestra.
// Las OC de muestra no traen recepciones con fecha: se toma 3 días después del despacho
// (o el día requerido si no hubo despacho) como momento en que quedó completa.

const DIA = 86_400_000;
const EVALUABLES = ['emitida', 'confirmada', 'despachada', 'recibida_parcial', 'recibida'];

function aOc(o: PurchaseOrder): OcAnalitica {
  const fechaRecepcion = o.fechaDespacho ? new Date(new Date(o.fechaDespacho).getTime() + 3 * DIA) : o.fechaRequerida ? new Date(o.fechaRequerida) : new Date(o.fechaEmision);
  return {
    id: o.id,
    numero: o.numero,
    proveedorId: o.proveedorId,
    proveedorNombre: db.partners.find((p) => p.id === o.proveedorId)?.nombre ?? '—',
    estado: o.estado,
    fechaEmision: new Date(o.fechaEmision),
    fechaRequerida: o.fechaRequerida ? new Date(o.fechaRequerida) : null,
    fechaConfirmadaProveedor: o.fechaConfirmadaProveedor ? new Date(o.fechaConfirmadaProveedor) : null,
    fechaDespacho: o.fechaDespacho ? new Date(o.fechaDespacho) : null,
    lineas: o.lineas.map((l) => ({
      cantidad: l.cantidad,
      cantidadRecibida: l.cantidadRecibida,
      recepciones: l.cantidadRecibida > 0 ? [{ fecha: fechaRecepcion }] : [],
    })),
  };
}

export function analiticaDemo(tenantId: string, desde?: string | null, hasta?: string | null, hoy = new Date()): AnaliticaResumen {
  const h = hasta ? new Date(hasta) : hoy;
  const d = desde ? new Date(desde) : new Date(h.getTime() - 90 * DIA);
  if (Number.isNaN(d.getTime()) || Number.isNaN(h.getTime())) throw new MockApiError(400, 'Las fechas no son válidas');
  if (d > h) throw new MockApiError(400, 'La fecha inicial no puede ser posterior a la final');
  if (h.getTime() - d.getTime() > 366 * DIA) throw new MockApiError(400, 'El periodo no puede pasar de 366 días');

  const metas = configEfectivaDemo().analitica;
  const propias = db.purchaseOrders.filter((o) => o.tenantId === tenantId).map(aOc);
  const delPeriodo = propias.filter((o) => EVALUABLES.includes(o.estado) && o.fechaRequerida && o.fechaRequerida >= d && o.fechaRequerida <= h);
  const entregados = db.shipments
    .filter((s) => s.tenantId === tenantId && s.estado === 'entregado' && s.fechaEstimadaLlegada)
    .map((s) => ({ llegadaEstimada: new Date(s.fechaEstimadaLlegada as string), entregadoAt: new Date(s.updatedAt) }))
    .filter((s) => s.llegadaEstimada >= d && s.llegadaEstimada <= h);

  return {
    periodo: { desde: d.toISOString(), hasta: h.toISOString() },
    generadoAt: hoy.toISOString(),
    metas: { otifPct: metas.metaOtifPct, atencionOtifPct: metas.umbralAtencionOtifPct },
    ...(JSON.parse(JSON.stringify(resumenAnalitica(delPeriodo, hoy))) as Omit<AnaliticaResumen, 'periodo' | 'generadoAt' | 'metas' | 'aging' | 'tendencia' | 'envios'>),
    aging: aging(propias.filter((o) => (ESTADOS_ABIERTOS as readonly string[]).includes(o.estado)), hoy),
    tendencia: tendenciaMensual(propias.filter((o) => EVALUABLES.includes(o.estado)), hoy),
    envios: puntualidadEnvios(entregados),
  };
}
