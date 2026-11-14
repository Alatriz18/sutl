import { ChecklistEnvio, EstadoItemChecklist, ItemChecklist, SutlDocument, TipoDocumento } from '@/types';
import * as db from './data';
import { MockApiError } from './errors';
import { configEfectivaDemo } from './tenant-config';

// Checklist de documentos del modo demo: mismas reglas que
// backend/src/modules/documents/checklist.ts (qué exige cada envío, última
// versión, pendiente/aprobado/rechazado, vencido y por vencer).

const DIA = 86_400_000;

export const ETIQUETA_TIPO: Record<TipoDocumento, string> = {
  bl: 'Conocimiento de embarque (BL)',
  awb: 'Guía aérea (AWB)',
  factura: 'Factura',
  pedimento: 'Pedimento',
  packing_list: 'Lista de empaque',
  otro: 'Otro documento',
};

const ETIQUETA_ESTADO: Record<EstadoItemChecklist, string> = {
  faltante: 'falta',
  pendiente: 'pendiente de revisión',
  aprobado: 'aprobado',
  rechazado: 'rechazado',
  vencido: 'vencido',
  por_vencer: 'por vencer',
};

// Los documentos de ejemplo no traen estado: se consideran aprobados.
const estadoDe = (d: SutlDocument) => d.estado ?? 'aprobado';

function requeridos(envio: { tipo: string; modo: string }) {
  const c = configEfectivaDemo().documentos;
  const out: TipoDocumento[] = [];
  if (c.exigirFactura) out.push('factura');
  if (c.exigirPackingList) out.push('packing_list');
  if (c.exigirDocumentoTransporte) {
    if (envio.modo === 'maritimo') out.push('bl');
    else if (envio.modo === 'aereo') out.push('awb');
  }
  if (c.exigirPedimento && envio.tipo === 'importacion') out.push('pedimento');
  return out;
}

function ultimas(docs: SutlDocument[]) {
  const m = new Map<TipoDocumento, SutlDocument>();
  for (const d of docs) {
    const a = m.get(d.tipo);
    if (!a || d.version > a.version) m.set(d.tipo, d);
  }
  return m;
}

function estadoItem(d: SutlDocument | undefined, hoy: Date): { estado: EstadoItemChecklist; diasParaVencer: number | null } {
  if (!d) return { estado: 'faltante', diasParaVencer: null };
  const venc = d.fechaVencimiento ? new Date(d.fechaVencimiento) : null;
  const dias = venc ? Math.floor((venc.getTime() - hoy.getTime()) / DIA) : null;
  const e = estadoDe(d);
  if (e === 'rechazado') return { estado: 'rechazado', diasParaVencer: dias };
  if (venc && venc.getTime() < hoy.getTime()) return { estado: 'vencido', diasParaVencer: dias };
  if (e === 'pendiente') return { estado: 'pendiente', diasParaVencer: dias };
  if (dias !== null && dias <= configEfectivaDemo().documentos.diasAvisoVencimiento) return { estado: 'por_vencer', diasParaVencer: dias };
  return { estado: 'aprobado', diasParaVencer: dias };
}

function item(tipo: TipoDocumento, requerido: boolean, d: SutlDocument | undefined, hoy: Date): ItemChecklist {
  return {
    tipo,
    requerido,
    documento: d
      ? { id: d.id, version: d.version, estado: estadoDe(d), fechaVencimiento: d.fechaVencimiento ?? null, motivoRechazo: d.motivoRechazo ?? null, nombreArchivo: d.nombreArchivo }
      : null,
    ...estadoItem(d, hoy),
  };
}

function evaluar(envio: { tipo: string; modo: string }, docs: SutlDocument[], hoy: Date) {
  const u = ultimas(docs);
  const req = requeridos(envio);
  const items = req.map((t) => item(t, true, u.get(t), hoy));
  const extras = [...u.keys()].filter((t) => !req.includes(t)).map((t) => item(t, false, u.get(t), hoy));
  const problemas = items.filter((i) => i.estado !== 'aprobado' && i.estado !== 'por_vencer');
  return { items, extras, completo: problemas.length === 0, problemas: problemas.map((i) => ({ tipo: i.tipo, estado: i.estado })) };
}

export function checklistEnvio(tenantId: string, shipmentId: string, hoy = new Date()): ChecklistEnvio {
  const envio = db.shipments.find((s) => s.id === shipmentId && s.tenantId === tenantId);
  if (!envio) throw new MockApiError(404, 'Envío no encontrado');
  const docs = db.documents.filter((d) => d.shipmentId === shipmentId && d.tenantId === tenantId);
  return { envio: { id: envio.id, codigoGuia: envio.codigoGuia, tipo: envio.tipo, modo: envio.modo }, ...evaluar(envio, docs, hoy) };
}

export function revisarDocumento(tenantId: string, userId: string, id: string, body: Record<string, unknown>): SutlDocument {
  const doc = db.documents.find((d) => d.id === id && d.tenantId === tenantId);
  if (!doc) throw new MockApiError(404, 'Documento no encontrado');
  const estado = body.estado;
  if (estado !== 'aprobado' && estado !== 'rechazado') throw new MockApiError(400, 'El estado debe ser aprobado o rechazado');
  const motivo = String(body.motivoRechazo ?? '').trim();
  if (estado === 'rechazado' && !motivo) throw new MockApiError(400, 'Indica el motivo del rechazo');
  const vigente = ultimas(db.documents.filter((d) => d.shipmentId === doc.shipmentId && d.tenantId === tenantId)).get(doc.tipo);
  if (vigente && vigente.version !== doc.version) throw new MockApiError(409, 'Ya existe una versión más reciente de este documento');
  doc.estado = estado;
  doc.motivoRechazo = estado === 'rechazado' ? motivo : null;
  void userId;
  return db.documentExpanded(doc);
}

// Envíos activos por llegar (o ya pasados) con documentación incompleta.
export function enviosConDocumentosPendientes(tenantId: string, hoy = new Date()) {
  const c = configEfectivaDemo().documentos;
  const limite = hoy.getTime() + c.diasAntesEtaFaltante * DIA;
  const out: { shipmentId: string; codigoGuia: string; detalle: string; urgente: boolean }[] = [];
  const envios = db.shipments
    .filter((s) => s.tenantId === tenantId && s.estado !== 'entregado' && s.fechaEstimadaLlegada && new Date(s.fechaEstimadaLlegada).getTime() <= limite)
    .sort((a, b) => (a.fechaEstimadaLlegada as string).localeCompare(b.fechaEstimadaLlegada as string));
  for (const e of envios) {
    const r = evaluar(e, db.documents.filter((d) => d.shipmentId === e.id && d.tenantId === tenantId), hoy);
    if (r.completo) continue;
    const eta = new Date(e.fechaEstimadaLlegada as string).getTime();
    const lista = r.problemas.map((p) => `${ETIQUETA_TIPO[p.tipo]} (${ETIQUETA_ESTADO[p.estado]})`).join(', ');
    out.push({
      shipmentId: e.id,
      codigoGuia: e.codigoGuia,
      detalle: `El envío ${e.codigoGuia} ${eta < hoy.getTime() ? 'ya debió llegar' : 'está por llegar'} y su documentación no está completa: ${lista}.`,
      urgente: eta - hoy.getTime() <= 2 * DIA,
    });
  }
  return out;
}

// Documentos vigentes que vencen pronto (o ya vencieron) en envíos activos.
export function proximosVencimientosDocs(tenantId: string, hoy = new Date()) {
  const dias = configEfectivaDemo().documentos.diasAvisoVencimiento;
  const limite = hoy.getTime() + dias * DIA;
  const out: { id: string; shipmentId: string; codigoGuia: string; tipo: TipoDocumento; estado: EstadoItemChecklist; diasParaVencer: number | null }[] = [];
  for (const e of db.shipments.filter((s) => s.tenantId === tenantId && s.estado !== 'entregado')) {
    for (const d of ultimas(db.documents.filter((x) => x.shipmentId === e.id && x.tenantId === tenantId)).values()) {
      if (!d.fechaVencimiento || estadoDe(d) === 'rechazado' || new Date(d.fechaVencimiento).getTime() > limite) continue;
      out.push({ id: d.id, shipmentId: e.id, codigoGuia: e.codigoGuia, tipo: d.tipo, ...estadoItem(d, hoy) });
    }
  }
  return out.sort((a, b) => (a.diasParaVencer ?? 0) - (b.diasParaVencer ?? 0));
}
