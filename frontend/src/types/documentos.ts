import type { EstadoDocumento, TipoDocumento } from '@/types';

// Un documento de un envío tal como lo ve cada quien: el equipo ve con quién se comparte y quién lo subió;
// un externo solo ve si es de la empresa o suyo.
export interface DocumentoCompartido {
  id: string;
  tipo: TipoDocumento;
  version: number;
  estado: EstadoDocumento;
  nombreArchivo: string;
  fechaVencimiento: string | null;
  motivoRechazo: string | null;
  createdAt: string;
  // Solo para el equipo:
  visibleCliente?: boolean;
  visibleProveedor?: boolean;
  subidoPor?: { nombre: string; rol: string } | null;
  // Solo para externos:
  origen?: 'equipo' | 'propio';
}
