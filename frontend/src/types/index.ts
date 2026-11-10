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
  ordenesCompraLineas?: CargaOcDeEnvio[];
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

export type CanalNotificacion = 'email' | 'push' | 'sms' | 'whatsapp';
export type EstadoNotificacion = 'pendiente' | 'enviado' | 'fallido';

export interface CanalesDisponibles {
  email: boolean;
  whatsapp: boolean;
  push: boolean;
  sms: boolean;
}

export interface AppNotification {
  id: string;
  tenantId: string;
  userId: string | null;
  user?: User | null;
  canal: CanalNotificacion;
  tipo: string;
  asunto: string;
  mensaje: string;
  destino?: string | null;
  intentos?: number;
  error?: string | null;
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

// --- Integraciones: couriers, e-commerce y conectividad externa ---

export type CategoriaIntegracion = 'courier' | 'ecommerce' | 'naviera_aerolinea' | 'erp_externo';
export type EstadoIntegracion = 'conectado' | 'desconectado' | 'error';

export interface IntegrationProvider {
  id: string;
  categoria: CategoriaIntegracion;
  nombre: string;
  descripcion: string;
}

export interface Integration {
  id: string;
  tenantId: string;
  providerId: string;
  provider?: IntegrationProvider;
  estado: EstadoIntegracion;
  ultimaSincronizacion: string | null;
  enviosImportados: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApiKey {
  id: string;
  tenantId: string;
  nombre: string;
  llavePublica: string;
  ultimoUso: string | null;
  activo: boolean;
  createdAt: string;
}

export type EventoWebhook = 'envio.creado' | 'envio.actualizado' | 'envio.entregado' | 'factura.pagada';

export interface Webhook {
  id: string;
  tenantId: string;
  url: string;
  eventos: EventoWebhook[];
  activo: boolean;
  ultimoEnvio: string | null;
  ultimoEnvioOk: boolean | null;
  createdAt: string;
}

// --- Control de Órdenes de Compra (Supply Control) ---

export type EstadoOrdenCompra =
  | 'borrador'
  | 'emitida'
  | 'confirmada'
  | 'despachada'
  | 'recibida_parcial'
  | 'recibida'
  | 'cancelada';

export interface PurchaseOrderReceipt {
  id: string;
  tenantId: string;
  purchaseOrderLineId: string;
  cantidad: number;
  responsableId: string | null;
  // Bodega a la que entró al inventario; null si la recepción no movió stock.
  warehouseId: string | null;
  warehouse?: Pick<Warehouse, 'id' | 'nombre'> | null;
  notas: string | null;
  fecha: string;
  createdAt: string;
}

export interface PurchaseOrderLine {
  id: string;
  tenantId: string;
  purchaseOrderId: string;
  sku: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number | null;
  cantidadRecibida: number;
  recepciones?: PurchaseOrderReceipt[];
  // Embarques que traen esta línea y cuánto de ella en cada uno.
  embarques?: EmbarqueDeLinea[];
  createdAt: string;
  updatedAt: string;
}

export interface EmbarqueDeLinea {
  id?: string;
  cantidad: number;
  shipment: {
    id: string;
    codigoGuia: string;
    estado: EstadoEnvio;
    fechaEstimadaLlegada: string | null;
    origen?: string;
    destino?: string;
  };
}

// Carga de órdenes de compra que viaja en un embarque (detalle del envío).
export interface CargaOcDeEnvio {
  id: string;
  cantidad: number;
  linea: {
    id: string;
    sku: string;
    descripcion: string;
    unidad: string;
    cantidad: number;
    cantidadRecibida: number;
    purchaseOrder: {
      id: string;
      numero: string;
      estado: EstadoOrdenCompra;
      proveedor: { nombre: string } | null;
    };
  };
}

export interface PurchaseOrder {
  id: string;
  tenantId: string;
  numero: string;
  proveedorId: string;
  proveedor?: Pick<Partner, 'id' | 'nombre'> & Partial<Pick<Partner, 'taxId' | 'email' | 'contactoNombre'>>;
  estado: EstadoOrdenCompra;
  incoterm: string | null;
  moneda: string;
  fechaEmision: string;
  fechaRequerida: string | null;
  fechaConfirmadaProveedor: string | null;
  fechaDespacho: string | null;
  motivoCancelacion: string | null;
  notas: string | null;
  creadoPorId: string | null;
  lineas: PurchaseOrderLine[];
  createdAt: string;
  updatedAt: string;
}

// Configuración de la operación por tenant (ver backend/src/modules/tenant-config).
export type ModoRecepcionInventario = 'automatico' | 'a_eleccion' | 'nunca';

export interface ConfigOperacion {
  compras: {
    toleranciaSobreRecepcionPct: number;
    diasAlertaAnticipada: number;
    exigirFechaConfirmacion: boolean;
    vincularEmbarqueDespachaOc: boolean;
  };
  inventario: {
    recepcionActualizaInventario: ModoRecepcionInventario;
    diasCoberturaAlerta: number;
  };
}

export type AjustesOperacion = {
  [S in keyof ConfigOperacion]?: Partial<ConfigOperacion[S]>;
};

export interface PerfilOperacion {
  id: string;
  nombre: string;
  descripcion: string;
  config: ConfigOperacion;
}

export interface TenantConfigResponse {
  perfil: string;
  configuracion: ConfigOperacion;
  ajustes: AjustesOperacion;
  perfiles: PerfilOperacion[];
}

// Cobertura de inventario (ver backend/src/modules/inventory-coverage).
export interface FilaCobertura {
  sku: string;
  descripcion: string | null;
  unidad: string | null;
  stock: number | null;
  stockOrigen: 'sutl' | 'externo';
  consumoDiario: number | null;
  stockSeguridad: number | null;
  leadTimeDias: number | null;
  diasCobertura: number | null;
  bajoSeguridad: boolean;
  bajoCobertura: boolean;
  sinPolitica: boolean;
  unidadesMezcladas: boolean;
  pendienteOc: number;
  enCamino: number;
  proximaEta: string | null;
  policyId: string | null;
  existenciasExternasAt: string | null;
}

export interface CoberturaResponse {
  umbralDias: number;
  modoInventario: ModoRecepcionInventario;
  resumen: { skus: number; conPolitica: number; sinPolitica: number; bajoSeguridad: number; bajoCobertura: number };
  filas: FilaCobertura[];
}

// Riesgo de abastecimiento (ver backend/src/modules/supply-risk).
export type SemaforoRiesgo = 'rojo' | 'amarillo' | 'verde' | 'sin_datos';
export type AccionRiesgo =
  | 'adelantar_proveedor'
  | 'partir_envio'
  | 'compra_urgente'
  | 'confirmar_fecha'
  | 'planificar_compra'
  | 'ninguna';

export interface FilaRiesgo {
  sku: string;
  descripcion: string | null;
  unidad: string | null;
  stock: number | null;
  consumoDiario: number | null;
  diasCobertura: number | null;
  stockSeguridad: number | null;
  leadTimeDias: number | null;
  semaforo: SemaforoRiesgo;
  accion: AccionRiesgo;
  motivo: string;
  fechaQuiebre: string | null;
  diasSinStock: number;
  cubiertoHasta: string | null;
  fechaBajoSeguridad: string | null;
  reposicionesSinFecha: number;
  reposicionesVencidas: number;
  reposiciones: { origen: 'embarque' | 'oc'; referencia: string; cantidad: number; fecha: string | null }[];
}

export interface RiesgoResponse {
  evaluadoAt: string;
  umbralDias: number;
  resumen: { rojo: number; amarillo: number; verde: number; sinDatos: number; acciones: Partial<Record<AccionRiesgo, number>> };
  filas: FilaRiesgo[];
}

export interface InventoryPolicy {
  id: string;
  sku: string;
  consumoDiario: number;
  stockSeguridad: number;
  leadTimeDias: number | null;
  existenciasExternas: number | null;
  existenciasExternasAt: string | null;
}

export type TipoImportacion = 'ordenes_compra' | 'politicas_inventario';

export interface ImportMappingResponse {
  tipo: TipoImportacion;
  mapeo: Record<string, string> | null;
}
