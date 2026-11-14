import { EstadoDocumento, ModoTransporte, TipoDocumento, TipoEnvio } from '@prisma/client';
import { ConfigOperacion } from '../tenant-config/tenant-config.defaults';

const DIA_MS = 86_400_000;

export type EstadoItem = 'faltante' | 'pendiente' | 'aprobado' | 'rechazado' | 'vencido' | 'por_vencer';

export interface DocumentoVersion {
  id: string;
  tipo: TipoDocumento;
  version: number;
  estado: EstadoDocumento;
  fechaVencimiento: Date | null;
  motivoRechazo: string | null;
  nombreArchivo: string;
}

export interface ItemChecklist {
  tipo: TipoDocumento;
  requerido: boolean;
  estado: EstadoItem;
  documento: DocumentoVersion | null;
  // Días hasta el vencimiento (negativo si ya venció); null si no vence.
  diasParaVencer: number | null;
}

// Qué documentos exige un envío según su tipo (importación/exportación), su modo
// de transporte y lo que la empresa configuró. Es una función pura, sin base de datos.
export function tiposRequeridos(
  envio: { tipo: TipoEnvio; modo: ModoTransporte },
  cfg: ConfigOperacion['documentos'],
): TipoDocumento[] {
  const out: TipoDocumento[] = [];
  if (cfg.exigirFactura) out.push('factura');
  if (cfg.exigirPackingList) out.push('packing_list');
  if (cfg.exigirDocumentoTransporte) {
    if (envio.modo === 'maritimo') out.push('bl');
    else if (envio.modo === 'aereo') out.push('awb');
  }
  if (cfg.exigirPedimento && envio.tipo === 'importacion') out.push('pedimento');
  return out;
}

// Solo cuenta la última versión de cada tipo: una carga nueva reemplaza a la anterior.
export function ultimasVersiones(documentos: DocumentoVersion[]): Map<TipoDocumento, DocumentoVersion> {
  const m = new Map<TipoDocumento, DocumentoVersion>();
  for (const d of documentos) {
    const actual = m.get(d.tipo);
    if (!actual || d.version > actual.version) m.set(d.tipo, d);
  }
  return m;
}

export function estadoDelItem(doc: DocumentoVersion | undefined, diasAviso: number, hoy: Date): { estado: EstadoItem; diasParaVencer: number | null } {
  if (!doc) return { estado: 'faltante', diasParaVencer: null };
  const dias = doc.fechaVencimiento ? Math.floor((doc.fechaVencimiento.getTime() - hoy.getTime()) / DIA_MS) : null;
  if (doc.estado === 'rechazado') return { estado: 'rechazado', diasParaVencer: dias };
  if (dias !== null && doc.fechaVencimiento!.getTime() < hoy.getTime()) return { estado: 'vencido', diasParaVencer: dias };
  if (doc.estado === 'pendiente') return { estado: 'pendiente', diasParaVencer: dias };
  if (dias !== null && dias <= diasAviso) return { estado: 'por_vencer', diasParaVencer: dias };
  return { estado: 'aprobado', diasParaVencer: dias };
}

// Un documento por vencer sigue valiendo: el checklist se considera completo
// mientras todo lo requerido esté aprobado (aunque algo venza pronto).
const CUMPLE: EstadoItem[] = ['aprobado', 'por_vencer'];

export function evaluarChecklist(
  envio: { tipo: TipoEnvio; modo: ModoTransporte },
  documentos: DocumentoVersion[],
  cfg: ConfigOperacion['documentos'],
  hoy: Date,
) {
  const ultimas = ultimasVersiones(documentos);
  const requeridos = tiposRequeridos(envio, cfg);
  const construir = (tipo: TipoDocumento, requerido: boolean): ItemChecklist => {
    const documento = ultimas.get(tipo) ?? null;
    return { tipo, requerido, documento, ...estadoDelItem(documento ?? undefined, cfg.diasAvisoVencimiento, hoy) };
  };
  const items = requeridos.map((t) => construir(t, true));
  // Lo subido que no era obligatorio también se muestra (p. ej. «otro»).
  const extras = [...ultimas.keys()].filter((t) => !requeridos.includes(t)).map((t) => construir(t, false));
  const problemas = items.filter((i) => !CUMPLE.includes(i.estado));
  return {
    items,
    extras,
    completo: problemas.length === 0,
    problemas: problemas.map((i) => ({ tipo: i.tipo, estado: i.estado })),
  };
}

export const ETIQUETA_TIPO: Record<TipoDocumento, string> = {
  bl: 'Conocimiento de embarque (BL)',
  awb: 'Guía aérea (AWB)',
  factura: 'Factura',
  pedimento: 'Pedimento',
  packing_list: 'Lista de empaque',
  otro: 'Otro documento',
};

export const ETIQUETA_ESTADO: Record<EstadoItem, string> = {
  faltante: 'falta',
  pendiente: 'pendiente de revisión',
  aprobado: 'aprobado',
  rechazado: 'rechazado',
  vencido: 'vencido',
  por_vencer: 'por vencer',
};
