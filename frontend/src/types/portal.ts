import { EstadoEnvio, ModoTransporte, TipoEnvio } from '@/types';

export interface MensajePortal {
  id: string;
  texto: string;
  createdAt: string;
  autor: { id: string; nombre: string | null };
  // Habló el equipo de la empresa (true) o un externo (false).
  delEquipo: boolean;
}

// Lo que ve un cliente final de SUS envíos (ver backend: SELECT_CLIENTE). Sin datos internos.
export interface EnvioDeCliente {
  id: string;
  codigoGuia: string;
  tipo: TipoEnvio;
  modo: ModoTransporte;
  estado: EstadoEnvio;
  origen: string;
  destino: string;
  puertoOrigen: string | null;
  puertoDestino: string | null;
  pesoKg: number | null;
  referenciaDocumento: string | null;
  remitenteNombre: string;
  destinatarioNombre: string;
  fechaEstimadaSalida: string | null;
  fechaEstimadaLlegada: string | null;
  createdAt: string;
  carrier: { nombre: string } | null;
}

export interface EventoDeCliente {
  _id: string;
  estado: EstadoEnvio;
  ubicacion?: string;
  descripcion?: string;
  timestamp: string;
}
