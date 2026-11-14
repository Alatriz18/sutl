// Prueba de entrega (ver backend/src/modules/delivery).

export interface PruebaEntrega {
  id: string;
  receptorNombre: string;
  receptorDocumento: string | null;
  entregadoAt: string;
  observaciones: string | null;
  archivoNombre: string | null;
  tieneArchivo: boolean;
  createdAt: string;
  registradoPor: { nombre: string };
}

export interface ResultadoRegistroPod {
  pod: PruebaEntrega;
  // Qué pasó con cada orden de compra cuando se pidió recibirlas.
  recepciones: { numero: string; ok: boolean; error?: string }[];
}
