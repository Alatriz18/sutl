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
  carrier?: Carrier | null;
  bookingId?: string | null;
  containerId?: string | null;
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

// --- ERP logístico: CRM, cotizaciones, reservas ---

export type TipoPartner = 'cliente' | 'agente' | 'proveedor' | 'transportista';

export interface Partner {
  id: string;
  tenantId: string;
  tipo: TipoPartner;
  nombre: string;
  taxId: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  contactoNombre: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export type EstadoCotizacion = 'borrador' | 'enviada' | 'aprobada' | 'rechazada' | 'convertida';

export interface Quote {
  id: string;
  tenantId: string;
  numero: string;
  clienteId: string;
  cliente?: Partner;
  tipo: TipoEnvio;
  modo: ModoTransporte;
  carrierId: string | null;
  carrier?: Carrier | null;
  origen: string;
  destino: string;
  pesoKg: number | null;
  volumenM3: number | null;
  tarifaEstimada: number | null;
  moneda: string;
  estado: EstadoCotizacion;
  validoHasta: string | null;
  notas: string | null;
  createdAt: string;
  updatedAt: string;
}

export type EstadoReserva = 'pendiente' | 'confirmada' | 'cancelada' | 'convertida';

export interface Booking {
  id: string;
  tenantId: string;
  quoteId: string | null;
  clienteId: string;
  cliente?: Partner;
  tipo: TipoEnvio;
  modo: ModoTransporte;
  carrierId: string | null;
  carrier?: Carrier | null;
  origen: string;
  destino: string;
  fechaEstimadaCarga: string | null;
  estado: EstadoReserva;
  shipment?: Shipment | null;
  createdAt: string;
  updatedAt: string;
}

// --- ERP logístico: tarifas, contratos, facturación, contenedores, WMS, flota ---

export interface Rate {
  id: string;
  tenantId: string | null;
  carrierId: string;
  carrier?: Carrier;
  origen: string;
  destino: string;
  modo: ModoTransporte;
  tipo: TipoEnvio;
  unidad: string;
  precioBase: number;
  moneda: string;
  vigenteDesde: string;
  vigenteHasta: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Contract {
  id: string;
  tenantId: string;
  carrierId: string;
  carrier?: Carrier;
  nombre: string;
  numeroContrato: string | null;
  vigenteDesde: string;
  vigenteHasta: string | null;
  condiciones: Record<string, unknown> | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export type TipoFactura = 'cxc' | 'cxp';
export type EstadoFactura = 'pendiente' | 'pagada' | 'vencida' | 'anulada';

export interface Payment {
  id: string;
  tenantId: string;
  invoiceId: string;
  monto: number;
  metodo: string | null;
  referencia: string | null;
  fecha: string;
  createdAt: string;
}

export interface Invoice {
  id: string;
  tenantId: string;
  tipo: TipoFactura;
  numero: string;
  partnerId: string;
  partner?: Partner;
  shipmentId: string | null;
  shipment?: Shipment | null;
  montoTotal: number;
  moneda: string;
  estado: EstadoFactura;
  fechaEmision: string;
  fechaVencimiento: string | null;
  pagos?: Payment[];
  createdAt: string;
  updatedAt: string;
}

export type EstadoContenedor = 'abierto' | 'cerrado' | 'en_transito' | 'entregado';

export interface Container {
  id: string;
  tenantId: string;
  numeroContenedor: string;
  tipo: string | null;
  carrierId: string | null;
  carrier?: Carrier | null;
  origen: string;
  destino: string;
  estado: EstadoContenedor;
  capacidadM3: number | null;
  fechaCierre: string | null;
  envios?: Shipment[];
  createdAt: string;
  updatedAt: string;
}

export interface WarehouseLocation {
  id: string;
  warehouseId: string;
  codigo: string;
  tipo: string | null;
  capacidad: number | null;
  createdAt: string;
}

export interface Warehouse {
  id: string;
  tenantId: string;
  nombre: string;
  direccion: string | null;
  activo: boolean;
  ubicaciones?: WarehouseLocation[];
  _count?: { items: number };
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItem {
  id: string;
  tenantId: string;
  warehouseId: string;
  warehouse?: Warehouse;
  ubicacionId: string | null;
  ubicacion?: WarehouseLocation | null;
  shipmentId: string | null;
  sku: string | null;
  descripcion: string;
  cantidad: number;
  unidad: string;
  createdAt: string;
  updatedAt: string;
}

export type EstadoVehiculo = 'disponible' | 'en_ruta' | 'mantenimiento' | 'inactivo';

export interface Driver {
  id: string;
  tenantId: string;
  nombre: string;
  licencia: string;
  telefono: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleAssignment {
  id: string;
  tenantId: string;
  vehicleId: string;
  driverId: string;
  driver?: Driver;
  vehicle?: Vehicle;
  shipmentId: string | null;
  fechaAsignacion: string;
  fechaFin: string | null;
  createdAt: string;
}

export interface Vehicle {
  id: string;
  tenantId: string;
  placa: string;
  tipo: string;
  capacidadKg: number | null;
  estado: EstadoVehiculo;
  asignaciones?: VehicleAssignment[];
  createdAt: string;
  updatedAt: string;
}

// --- Documentos, alertas, notificaciones, reportes ---

export type TipoDocumento = 'bl' | 'awb' | 'factura' | 'pedimento' | 'packing_list' | 'otro';

export interface SutlDocument {
  id: string;
  tenantId: string;
  shipmentId: string;
  shipment?: Shipment;
  tipo: TipoDocumento;
  nombreArchivo: string;
  urlArchivo: string;
  version: number;
  subidoPorId: string | null;
  subidoPor?: User | null;
  createdAt: string;
}

export type TipoAlerta =
  | 'retraso'
  | 'cambio_estado'
  | 'llegada_proxima'
  | 'documento_faltante'
  | 'personalizada';

export interface Alert {
  id: string;
  tenantId: string;
  shipmentId: string | null;
  shipment?: Shipment | null;
  tipo: TipoAlerta;
  condicion: Record<string, unknown>;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AlertaEvaluada {
  alerta: Alert;
  disparados: Shipment[];
}

export type CanalNotificacion = 'email' | 'push' | 'sms';
export type EstadoNotificacion = 'pendiente' | 'enviado' | 'fallido';

export interface AppNotification {
  id: string;
  tenantId: string;
  userId: string | null;
  user?: User | null;
  canal: CanalNotificacion;
  tipo: string;
  asunto: string;
  mensaje: string;
  estado: EstadoNotificacion;
  enviadoAt: string | null;
  createdAt: string;
}

export interface Report {
  id: string;
  tenantId: string;
  tipo: string;
  formato: string;
  urlArchivo: string | null;
  generadoPorId: string | null;
  generadoPor?: User | null;
  createdAt: string;
}
