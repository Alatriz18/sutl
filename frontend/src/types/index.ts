export type RolUsuario = 'super_admin' | 'admin_tenant' | 'operador' | 'cliente_final';

export type EstadoEnvio = 'creado' | 'en_transito' | 'en_aduana' | 'entregado' | 'incidencia';

export type TipoEnvio = 'importacion' | 'exportacion';

export type ModoTransporte = 'maritimo' | 'aereo' | 'terrestre';

export type TipoCarrier = 'naviera' | 'aerolinea' | 'terrestre';

export interface Carrier {
  id: string;
  nombre: string;
  tipo: TipoCarrier;
  codigo: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Tenant {
  id: string;
  nombre: string;
  ruc: string | null;
  plan: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  tenantId: string;
  email: string;
  nombre: string;
  rol: RolUsuario;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Shipment {
  id: string;
  tenantId: string;
  codigoGuia: string;
  tipo: TipoEnvio;
  modo: ModoTransporte;
  carrierId: string | null;
  referenciaDocumento: string | null;
  remitenteNombre: string;
  destinatarioNombre: string;
  destinatarioEmail: string | null;
  origen: string;
  destino: string;
  puertoOrigen: string | null;
  puertoDestino: string | null;
  pesoKg: number | null;
  fechaEstimadaSalida: string | null;
  fechaEstimadaLlegada: string | null;
  estado: EstadoEnvio;
  createdAt: string;
  updatedAt: string;
}

export interface TrackingEvent {
  _id: string;
  shipmentId: string;
  tenantId: string;
  codigoGuia: string;
  estado: EstadoEnvio;
  ubicacion?: string;
  descripcion?: string;
  responsable: string;
  timestamp: string;
}

export interface TrackingPublicoResponse {
  codigoGuia: string;
  estado: EstadoEnvio;
  origen: string;
  destino: string;
  destinatarioNombre: string;
  createdAt: string;
  eventos: TrackingEvent[];
}
