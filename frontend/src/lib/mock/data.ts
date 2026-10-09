import {
  Alert,
  AppNotification,
  Booking,
  Carrier,
  Container,
  Contract,
  Driver,
  Invoice,
  InventoryItem,
  Partner,
  Payment,
  Quote,
  Rate,
  Report,
  Shipment,
  SutlDocument,
  Tenant,
  TrackingEvent,
  User,
  Vehicle,
  VehicleAssignment,
  Warehouse,
} from '@/types';

// Datos de muestra para el modo demo (NEXT_PUBLIC_DEMO_MODE=true).
// Reflejan el mismo dataset que backend/prisma/seed.ts, pero viven en memoria
// en el navegador — no requieren backend ni base de datos desplegada.

let seq = 1000;
export function nextId(prefix: string) {
  seq += 1;
  return `${prefix}-${seq}`;
}

const hoy = new Date();
const mesesAtras = (n: number, dia = 1) => new Date(hoy.getFullYear(), hoy.getMonth() - n, dia).toISOString();
const diasAtras = (n: number) => new Date(hoy.getTime() - n * 86400000).toISOString();
const diasAdelante = (n: number) => new Date(hoy.getTime() + n * 86400000).toISOString();

export const DEMO_CREDENCIALES = [
  { email: 'admin@sutl.dev', password: 'SutlAdmin2026!', nombre: 'Super Admin SUTL (panel SaaS)' },
  { email: 'admin@demo-transportes.com', password: 'Demo2026!', nombre: 'Admin — Transportes Demo S.A.' },
  { email: 'operador@demo-transportes.com', password: 'Demo2026!', nombre: 'Operador — Transportes Demo S.A.' },
];

export const tenants: Tenant[] = [
  {
    id: 't-svk',
    nombre: 'SVK Solutions',
    ruc: '0000000000001',
    plan: 'internal',
    activo: true,
    createdAt: mesesAtras(8),
    updatedAt: mesesAtras(1),
  },
  {
    id: 't-demo',
    nombre: 'Transportes Demo S.A.',
    ruc: '1790000000001',
    plan: 'trial',
    activo: true,
    createdAt: mesesAtras(6),
    updatedAt: mesesAtras(0, 10),
  },
];

export const users: User[] = [
  {
    id: 'u-superadmin',
    tenantId: 't-svk',
    email: 'admin@sutl.dev',
    nombre: 'Super Admin SUTL',
    rol: 'super_admin',
    activo: true,
    createdAt: mesesAtras(8),
    updatedAt: mesesAtras(8),
  },
  {
    id: 'u-admin',
    tenantId: 't-demo',
    email: 'admin@demo-transportes.com',
    nombre: 'Admin Demo',
    rol: 'admin_tenant',
    activo: true,
    createdAt: mesesAtras(6),
    updatedAt: mesesAtras(6),
  },
  {
    id: 'u-operador',
    tenantId: 't-demo',
    email: 'operador@demo-transportes.com',
    nombre: 'Operador Demo',
    rol: 'operador',
    activo: true,
    createdAt: mesesAtras(5),
    updatedAt: mesesAtras(5),
  },
];

export const passwordsByEmail: Record<string, string> = {
  'admin@sutl.dev': 'SutlAdmin2026!',
  'admin@demo-transportes.com': 'Demo2026!',
  'operador@demo-transportes.com': 'Demo2026!',
};

export const carriers: Carrier[] = [
  { id: 'c-maersk', nombre: 'Maersk', tipo: 'naviera', codigo: 'MAEU', activo: true, createdAt: mesesAtras(8), updatedAt: mesesAtras(8) },
  { id: 'c-msc', nombre: 'MSC', tipo: 'naviera', codigo: 'MSCU', activo: true, createdAt: mesesAtras(8), updatedAt: mesesAtras(8) },
  { id: 'c-cmacgm', nombre: 'CMA CGM', tipo: 'naviera', codigo: 'CMDU', activo: true, createdAt: mesesAtras(8), updatedAt: mesesAtras(8) },
  { id: 'c-hapag', nombre: 'Hapag-Lloyd', tipo: 'naviera', codigo: 'HLCU', activo: true, createdAt: mesesAtras(8), updatedAt: mesesAtras(8) },
  { id: 'c-evergreen', nombre: 'Evergreen', tipo: 'naviera', codigo: 'EGLV', activo: true, createdAt: mesesAtras(8), updatedAt: mesesAtras(8) },
  { id: 'c-iata', nombre: 'IATA CargoWise', tipo: 'aerolinea', codigo: 'CWIATA', activo: true, createdAt: mesesAtras(8), updatedAt: mesesAtras(8) },
];

function carrier(id: string) {
  return carriers.find((c) => c.id === id) ?? null;
}

export const shipments: Shipment[] = [
  {
    id: 's1', tenantId: 't-demo', codigoGuia: 'SUTL-DEMO-0001', tipo: 'exportacion', modo: 'maritimo',
    carrierId: 'c-maersk', bookingId: null, containerId: null, referenciaDocumento: 'MAEU1234567',
    remitenteNombre: 'Comercial Andina Cía. Ltda.', destinatarioNombre: 'Juan Pérez',
    destinatarioEmail: 'juan.perez@example.com', origen: 'Guayaquil, EC', destino: 'Quito, EC',
    puertoOrigen: 'Puerto de Guayaquil', puertoDestino: 'Puerto de Callao', pesoKg: 1250.5,
    fechaEstimadaSalida: diasAtras(2), fechaEstimadaLlegada: diasAdelante(4),
    estado: 'en_transito', createdAt: mesesAtras(0, 3), updatedAt: diasAtras(1),
  },
  {
    id: 's2', tenantId: 't-demo', codigoGuia: 'SUTL-DEMO-0002', tipo: 'importacion', modo: 'aereo',
    carrierId: 'c-iata', bookingId: null, containerId: null, referenciaDocumento: 'CW-88213',
    remitenteNombre: 'Shenzhen Electronics Co.', destinatarioNombre: 'TecnoImport S.A.',
    destinatarioEmail: 'compras@tecnoimport.ec', origen: 'Shenzhen, CN', destino: 'Guayaquil, EC',
    puertoOrigen: 'Aeropuerto de Shenzhen', puertoDestino: 'Aeropuerto José Joaquín de Olmedo', pesoKg: 340,
    fechaEstimadaSalida: diasAtras(8), fechaEstimadaLlegada: diasAtras(1),
    estado: 'en_aduana', createdAt: mesesAtras(0, 10), updatedAt: diasAtras(1),
  },
  {
    id: 's3', tenantId: 't-demo', codigoGuia: 'SUTL-DEMO-0003', tipo: 'exportacion', modo: 'maritimo',
    carrierId: 'c-msc', bookingId: null, containerId: 'cnt-1', referenciaDocumento: 'MSCU9988776',
    remitenteNombre: 'Bananera del Pacífico S.A.', destinatarioNombre: 'European Fruit Import GmbH',
    destinatarioEmail: null, origen: 'Guayaquil, EC', destino: 'Hamburgo, DE',
    puertoOrigen: 'Puerto de Guayaquil', puertoDestino: 'Puerto de Hamburgo', pesoKg: 18500,
    fechaEstimadaSalida: mesesAtras(1, 7), fechaEstimadaLlegada: mesesAtras(0, 2),
    estado: 'entregado', createdAt: mesesAtras(1, 5), updatedAt: mesesAtras(0, 2),
  },
  {
    id: 's4', tenantId: 't-demo', codigoGuia: 'SUTL-DEMO-0004', tipo: 'importacion', modo: 'terrestre',
    carrierId: null, bookingId: null, containerId: null, referenciaDocumento: null,
    remitenteNombre: 'Textiles Andinos Perú', destinatarioNombre: 'Moda EC Cía. Ltda.',
    destinatarioEmail: 'logistica@modaec.com', origen: 'Lima, PE', destino: 'Cuenca, EC',
    puertoOrigen: null, puertoDestino: null, pesoKg: 890,
    fechaEstimadaSalida: mesesAtras(1, 18), fechaEstimadaLlegada: mesesAtras(1, 23),
    estado: 'incidencia', createdAt: mesesAtras(1, 20), updatedAt: diasAtras(3),
  },
  {
    id: 's5', tenantId: 't-demo', codigoGuia: 'SUTL-DEMO-0005', tipo: 'exportacion', modo: 'aereo',
    carrierId: 'c-iata', bookingId: null, containerId: null, referenciaDocumento: 'CW-77104',
    remitenteNombre: 'Flores del Valle S.A.', destinatarioNombre: 'Amsterdam Flower Market',
    destinatarioEmail: null, origen: 'Quito, EC', destino: 'Ámsterdam, NL',
    puertoOrigen: 'Aeropuerto de Quito', puertoDestino: 'Aeropuerto de Schiphol', pesoKg: 2100,
    fechaEstimadaSalida: mesesAtras(2, 1), fechaEstimadaLlegada: mesesAtras(2, 3),
    estado: 'entregado', createdAt: mesesAtras(2, 2), updatedAt: mesesAtras(2, 3),
  },
  {
    id: 's6', tenantId: 't-demo', codigoGuia: 'SUTL-DEMO-0006', tipo: 'importacion', modo: 'maritimo',
    carrierId: 'c-cmacgm', bookingId: null, containerId: null, referenciaDocumento: 'CMDU4455667',
    remitenteNombre: 'Auto Parts USA Inc.', destinatarioNombre: 'Repuestos Continental',
    destinatarioEmail: 'importaciones@continental.ec', origen: 'Miami, US', destino: 'Guayaquil, EC',
    puertoOrigen: 'Puerto de Miami', puertoDestino: 'Puerto de Guayaquil', pesoKg: 5400,
    fechaEstimadaSalida: mesesAtras(2, 15), fechaEstimadaLlegada: mesesAtras(2, 18),
    estado: 'entregado', createdAt: mesesAtras(2, 18), updatedAt: mesesAtras(2, 18),
  },
  {
    id: 's7', tenantId: 't-demo', codigoGuia: 'SUTL-DEMO-0007', tipo: 'exportacion', modo: 'maritimo',
    carrierId: 'c-hapag', bookingId: null, containerId: 'cnt-1', referenciaDocumento: 'HLCU3321998',
    remitenteNombre: 'Cacao Fino de Aroma S.A.', destinatarioNombre: 'Swiss Chocolate Import AG',
    destinatarioEmail: null, origen: 'Guayaquil, EC', destino: 'Rotterdam, NL',
    puertoOrigen: 'Puerto de Guayaquil', puertoDestino: 'Puerto de Rotterdam', pesoKg: 9800,
    fechaEstimadaSalida: diasAtras(10), fechaEstimadaLlegada: diasAdelante(12),
    estado: 'en_transito', createdAt: mesesAtras(3, 8), updatedAt: diasAtras(10),
  },
  {
    id: 's8', tenantId: 't-demo', codigoGuia: 'SUTL-DEMO-0008', tipo: 'importacion', modo: 'aereo',
    carrierId: 'c-iata', bookingId: null, containerId: null, referenciaDocumento: 'CW-65332',
    remitenteNombre: 'MedSupply International', destinatarioNombre: 'Farmacéutica del Ecuador',
    destinatarioEmail: 'compras@farmaec.com', origen: 'Miami, US', destino: 'Quito, EC',
    puertoOrigen: 'Aeropuerto de Miami', puertoDestino: 'Aeropuerto de Quito', pesoKg: 120,
    fechaEstimadaSalida: mesesAtras(3, 23), fechaEstimadaLlegada: mesesAtras(3, 25),
    estado: 'entregado', createdAt: mesesAtras(3, 25), updatedAt: mesesAtras(3, 25),
  },
  {
    id: 's9', tenantId: 't-demo', codigoGuia: 'SUTL-DEMO-0009', tipo: 'exportacion', modo: 'maritimo',
    carrierId: 'c-evergreen', bookingId: null, containerId: null, referenciaDocumento: 'EGLV1198234',
    remitenteNombre: 'Camaronera del Golfo S.A.', destinatarioNombre: 'Asia Seafood Trading',
    destinatarioEmail: null, origen: 'Guayaquil, EC', destino: 'Busan, KR',
    puertoOrigen: 'Puerto de Guayaquil', puertoDestino: 'Puerto de Busan', pesoKg: 22000,
    fechaEstimadaSalida: diasAdelante(3), fechaEstimadaLlegada: diasAdelante(30),
    estado: 'creado', createdAt: mesesAtras(4, 14), updatedAt: mesesAtras(4, 14),
  },
  {
    id: 's10', tenantId: 't-demo', codigoGuia: 'SUTL-DEMO-0010', tipo: 'importacion', modo: 'maritimo',
    carrierId: 'c-maersk', bookingId: null, containerId: null, referenciaDocumento: 'MAEU7789012',
    remitenteNombre: 'Maquinaria Industrial GmbH', destinatarioNombre: 'Constructora del Pacífico',
    destinatarioEmail: 'compras@constructorapacifico.ec', origen: 'Hamburgo, DE', destino: 'Guayaquil, EC',
    puertoOrigen: 'Puerto de Hamburgo', puertoDestino: 'Puerto de Guayaquil', pesoKg: 31000,
    fechaEstimadaSalida: mesesAtras(5, 1), fechaEstimadaLlegada: mesesAtras(5, 6),
    estado: 'entregado', createdAt: mesesAtras(5, 6), updatedAt: mesesAtras(5, 6),
  },
];

export function shipmentWithCarrier(s: Shipment): Shipment {
  return { ...s, carrier: s.carrierId ? carrier(s.carrierId) : null };
}

export const trackingEventsByShipment: Record<string, TrackingEvent[]> = {
  s1: [
    { _id: 'te-1-1', shipmentId: 's1', tenantId: 't-demo', codigoGuia: 'SUTL-DEMO-0001', estado: 'creado', ubicacion: 'Guayaquil, EC', descripcion: 'Envío registrado en el sistema.', responsable: 'Admin Demo', timestamp: mesesAtras(0, 3) },
    { _id: 'te-1-2', shipmentId: 's1', tenantId: 't-demo', codigoGuia: 'SUTL-DEMO-0001', estado: 'en_transito', ubicacion: 'Puerto de Guayaquil', descripcion: 'Carga embarcada rumbo a Callao.', responsable: 'Operador Demo', timestamp: diasAtras(2) },
  ],
  s2: [
    { _id: 'te-2-1', shipmentId: 's2', tenantId: 't-demo', codigoGuia: 'SUTL-DEMO-0002', estado: 'creado', ubicacion: 'Shenzhen, CN', descripcion: 'Envío registrado.', responsable: 'Admin Demo', timestamp: mesesAtras(0, 10) },
    { _id: 'te-2-2', shipmentId: 's2', tenantId: 't-demo', codigoGuia: 'SUTL-DEMO-0002', estado: 'en_transito', ubicacion: 'Aeropuerto de Shenzhen', descripcion: 'Vuelo de carga despachado.', responsable: 'Operador Demo', timestamp: diasAtras(6) },
    { _id: 'te-2-3', shipmentId: 's2', tenantId: 't-demo', codigoGuia: 'SUTL-DEMO-0002', estado: 'en_aduana', ubicacion: 'Aeropuerto José Joaquín de Olmedo', descripcion: 'Retenido para inspección aduanera.', responsable: 'Operador Demo', timestamp: diasAtras(1) },
  ],
  s3: [
    { _id: 'te-3-1', shipmentId: 's3', tenantId: 't-demo', codigoGuia: 'SUTL-DEMO-0003', estado: 'creado', ubicacion: 'Guayaquil, EC', descripcion: 'Envío registrado.', responsable: 'Admin Demo', timestamp: mesesAtras(1, 5) },
    { _id: 'te-3-2', shipmentId: 's3', tenantId: 't-demo', codigoGuia: 'SUTL-DEMO-0003', estado: 'en_transito', ubicacion: 'Puerto de Guayaquil', descripcion: 'Contenedor embarcado en MSC Valencia.', responsable: 'Operador Demo', timestamp: mesesAtras(1, 7) },
    { _id: 'te-3-3', shipmentId: 's3', tenantId: 't-demo', codigoGuia: 'SUTL-DEMO-0003', estado: 'entregado', ubicacion: 'Puerto de Hamburgo', descripcion: 'Entregado a European Fruit Import GmbH.', responsable: 'Operador Demo', timestamp: mesesAtras(0, 2) },
  ],
  s4: [
    { _id: 'te-4-1', shipmentId: 's4', tenantId: 't-demo', codigoGuia: 'SUTL-DEMO-0004', estado: 'creado', ubicacion: 'Lima, PE', descripcion: 'Envío registrado.', responsable: 'Admin Demo', timestamp: mesesAtras(1, 20) },
    { _id: 'te-4-2', shipmentId: 's4', tenantId: 't-demo', codigoGuia: 'SUTL-DEMO-0004', estado: 'incidencia', ubicacion: 'Frontera Huaquillas', descripcion: 'Retraso aduanero no planificado.', responsable: 'Operador Demo', timestamp: diasAtras(3) },
  ],
  s7: [
    { _id: 'te-7-1', shipmentId: 's7', tenantId: 't-demo', codigoGuia: 'SUTL-DEMO-0007', estado: 'creado', ubicacion: 'Guayaquil, EC', descripcion: 'Envío registrado.', responsable: 'Admin Demo', timestamp: mesesAtras(3, 8) },
    { _id: 'te-7-2', shipmentId: 's7', tenantId: 't-demo', codigoGuia: 'SUTL-DEMO-0007', estado: 'en_transito', ubicacion: 'Puerto de Guayaquil', descripcion: 'Contenedor consolidado embarcado.', responsable: 'Operador Demo', timestamp: diasAtras(10) },
  ],
};

export const partners: Partner[] = [
  { id: 'p-cliente-andino', tenantId: 't-demo', tipo: 'cliente', nombre: 'Importadora Andina S.A.', taxId: '0991234567001', email: 'compras@importadoraandina.ec', telefono: '+593 4 2345678', direccion: null, contactoNombre: 'María Sánchez', activo: true, createdAt: mesesAtras(6), updatedAt: mesesAtras(6) },
  { id: 'p-cliente-exportador', tenantId: 't-demo', tipo: 'cliente', nombre: 'Exportadora Tropical Cía. Ltda.', taxId: '0997654321001', email: 'ventas@tropicalexport.ec', telefono: '+593 4 2987654', direccion: null, contactoNombre: 'Carlos Vera', activo: true, createdAt: mesesAtras(6), updatedAt: mesesAtras(6) },
  { id: 'p-agente-asia', tenantId: 't-demo', tipo: 'agente', nombre: 'Asia Pacific Freight Agents Ltd.', taxId: null, email: 'ops@apfreight.cn', telefono: '+86 21 5555 0199', direccion: null, contactoNombre: 'Li Wei', activo: true, createdAt: mesesAtras(5), updatedAt: mesesAtras(5) },
  { id: 'p-transportista-local', tenantId: 't-demo', tipo: 'transportista', nombre: 'Transportes Costa Sierra S.A.', taxId: '0993334445001', email: null, telefono: '+593 9 8877 6655', direccion: null, contactoNombre: 'Jorge Paredes', activo: true, createdAt: mesesAtras(5), updatedAt: mesesAtras(5) },
];

function partner(id: string) {
  return partners.find((p) => p.id === id);
}

export const quotes: Quote[] = [
  {
    id: 'q1', tenantId: 't-demo', numero: 'COT-DEMO0001', clienteId: 'p-cliente-andino', tipo: 'importacion',
    modo: 'maritimo', carrierId: 'c-maersk', origen: 'Shanghai, CN', destino: 'Guayaquil, EC',
    pesoKg: 8000, volumenM3: 28, tarifaEstimada: 2400, moneda: 'USD', estado: 'aprobada',
    validoHasta: diasAdelante(30), notas: 'Contenedor 40HC, mercadería general.',
    createdAt: mesesAtras(2), updatedAt: mesesAtras(1),
  },
  {
    id: 'q2', tenantId: 't-demo', numero: 'COT-DEMO0002', clienteId: 'p-cliente-exportador', tipo: 'exportacion',
    modo: 'aereo', carrierId: 'c-iata', origen: 'Quito, EC', destino: 'Miami, US',
    pesoKg: 450, volumenM3: null, tarifaEstimada: 980, moneda: 'USD', estado: 'borrador',
    validoHasta: null, notas: 'Pendiente confirmar fecha de despacho con el cliente.',
    createdAt: mesesAtras(1), updatedAt: mesesAtras(1),
  },
];

export function quoteExpanded(q: Quote): Quote {
  return { ...q, cliente: partner(q.clienteId), carrier: q.carrierId ? carrier(q.carrierId) : null };
}

export const bookings: Booking[] = [
  {
    id: 'b1', tenantId: 't-demo', quoteId: 'q1', clienteId: 'p-cliente-andino', tipo: 'importacion',
    modo: 'maritimo', carrierId: 'c-maersk', origen: 'Shanghai, CN', destino: 'Guayaquil, EC',
    fechaEstimadaCarga: diasAdelante(15), estado: 'confirmada', shipment: null,
    createdAt: mesesAtras(1), updatedAt: mesesAtras(1),
  },
  {
    id: 'b2', tenantId: 't-demo', quoteId: null, clienteId: 'p-cliente-exportador', tipo: 'exportacion',
    modo: 'terrestre', carrierId: null, origen: 'Cuenca, EC', destino: 'Lima, PE',
    fechaEstimadaCarga: null, estado: 'pendiente', shipment: null,
    createdAt: mesesAtras(0, 12), updatedAt: mesesAtras(0, 12),
  },
];

export function bookingExpanded(b: Booking): Booking {
  const shipment = shipments.find((s) => s.bookingId === b.id);
  return {
    ...b,
    cliente: partner(b.clienteId),
    carrier: b.carrierId ? carrier(b.carrierId) : null,
    shipment: shipment ? shipmentWithCarrier(shipment) : null,
  };
}

export const rates: Rate[] = [
  { id: 'r1', tenantId: 't-demo', carrierId: 'c-maersk', origen: 'Guayaquil, EC', destino: 'Callao, PE', modo: 'maritimo', tipo: 'exportacion', unidad: 'contenedor_40', precioBase: 1850, moneda: 'USD', vigenteDesde: mesesAtras(3), vigenteHasta: null, activo: true, createdAt: mesesAtras(3), updatedAt: mesesAtras(3) },
  { id: 'r2', tenantId: 't-demo', carrierId: 'c-msc', origen: 'Guayaquil, EC', destino: 'Hamburgo, DE', modo: 'maritimo', tipo: 'exportacion', unidad: 'contenedor_20', precioBase: 2400, moneda: 'USD', vigenteDesde: mesesAtras(3), vigenteHasta: null, activo: true, createdAt: mesesAtras(3), updatedAt: mesesAtras(3) },
  { id: 'r3', tenantId: 't-demo', carrierId: 'c-iata', origen: 'Quito, EC', destino: 'Miami, US', modo: 'aereo', tipo: 'exportacion', unidad: 'kg', precioBase: 2.35, moneda: 'USD', vigenteDesde: mesesAtras(3), vigenteHasta: null, activo: true, createdAt: mesesAtras(3), updatedAt: mesesAtras(3) },
];

export function rateExpanded(r: Rate): Rate {
  return { ...r, carrier: carrier(r.carrierId) ?? undefined };
}

export const contracts: Contract[] = [
  {
    id: 'ctr1', tenantId: 't-demo', carrierId: 'c-maersk', nombre: 'Contrato marco Maersk 2026',
    numeroContrato: 'CTR-2026-014', vigenteDesde: new Date(hoy.getFullYear(), 0, 1).toISOString(),
    vigenteHasta: new Date(hoy.getFullYear(), 11, 31).toISOString(), condiciones: null, activo: true,
    createdAt: mesesAtras(6), updatedAt: mesesAtras(6),
  },
];

export function contractExpanded(c: Contract): Contract {
  return { ...c, carrier: carrier(c.carrierId) ?? undefined };
}

export const containers: Container[] = [
  {
    id: 'cnt-1', tenantId: 't-demo', numeroContenedor: 'MSCU5544332', tipo: '40HC', carrierId: 'c-msc',
    origen: 'Guayaquil, EC', destino: 'Hamburgo, DE', estado: 'en_transito', capacidadM3: 76,
    fechaCierre: null, createdAt: mesesAtras(1, 5), updatedAt: mesesAtras(1, 5),
  },
];

export function containerExpanded(c: Container): Container {
  return {
    ...c,
    carrier: c.carrierId ? carrier(c.carrierId) : null,
    envios: shipments.filter((s) => s.containerId === c.id).map(shipmentWithCarrier),
  };
}

export const warehouseLocations: Warehouse['ubicaciones'] = [
  { id: 'wl-1', warehouseId: 'wh-1', codigo: 'A-01-03', tipo: 'estante', capacidad: 500, createdAt: mesesAtras(6) },
];

export const warehouses: Warehouse[] = [
  {
    id: 'wh-1', tenantId: 't-demo', nombre: 'Bodega Guayaquil Central', direccion: 'Vía a Daule km 8',
    activo: true, createdAt: mesesAtras(6), updatedAt: mesesAtras(6),
  },
];

export function warehouseExpanded(w: Warehouse): Warehouse {
  return {
    ...w,
    ubicaciones: warehouseLocations?.filter((u) => u.warehouseId === w.id),
    _count: { items: inventoryItems.filter((i) => i.warehouseId === w.id).length },
  };
}

export const inventoryItems: InventoryItem[] = [
  {
    id: 'inv-1', tenantId: 't-demo', warehouseId: 'wh-1', ubicacionId: 'wl-1', shipmentId: null,
    sku: 'ELEC-4471', descripcion: 'Componentes electrónicos (caja)', cantidad: 120, unidad: 'unidad',
    createdAt: mesesAtras(2), updatedAt: mesesAtras(2),
  },
];

export function inventoryItemExpanded(i: InventoryItem): InventoryItem {
  return {
    ...i,
    warehouse: warehouses.find((w) => w.id === i.warehouseId),
    ubicacion: warehouseLocations?.find((u) => u.id === i.ubicacionId) ?? null,
  };
}

export const drivers: Driver[] = [
  { id: 'drv-1', tenantId: 't-demo', nombre: 'Jorge Paredes', licencia: 'ECU-998877', telefono: '+593 9 8877 6655', activo: true, createdAt: mesesAtras(5), updatedAt: mesesAtras(5) },
];

export const vehicleAssignments: VehicleAssignment[] = [
  { id: 'va-1', tenantId: 't-demo', vehicleId: 'veh-1', driverId: 'drv-1', shipmentId: null, fechaAsignacion: mesesAtras(1), fechaFin: null, createdAt: mesesAtras(1) },
];

export const vehicles: Vehicle[] = [
  { id: 'veh-1', tenantId: 't-demo', placa: 'GYE-4471', tipo: 'Camión 3.5T', capacidadKg: 3500, estado: 'en_ruta', createdAt: mesesAtras(5), updatedAt: mesesAtras(5) },
];

export function vehicleExpanded(v: Vehicle): Vehicle {
  return {
    ...v,
    asignaciones: vehicleAssignments
      .filter((a) => a.vehicleId === v.id)
      .map((a) => ({ ...a, driver: drivers.find((d) => d.id === a.driverId) })),
  };
}

export const payments: Payment[] = [];

export const invoices: Invoice[] = [
  {
    id: 'inv-cxc-1', tenantId: 't-demo', tipo: 'cxc', numero: 'FAC-CXC-DEMO1', partnerId: 'p-cliente-andino',
    shipmentId: 's3', montoTotal: 2400, moneda: 'USD', estado: 'pendiente',
    fechaEmision: mesesAtras(1), fechaVencimiento: diasAdelante(15),
    createdAt: mesesAtras(1), updatedAt: mesesAtras(1),
  },
  {
    id: 'inv-cxp-1', tenantId: 't-demo', tipo: 'cxp', numero: 'FAC-CXP-DEMO1', partnerId: 'p-transportista-local',
    shipmentId: null, montoTotal: 320, moneda: 'USD', estado: 'vencida',
    fechaEmision: mesesAtras(2), fechaVencimiento: diasAtras(10),
    createdAt: mesesAtras(2), updatedAt: mesesAtras(2),
  },
];

export function invoiceExpanded(inv: Invoice): Invoice {
  return {
    ...inv,
    partner: partner(inv.partnerId),
    shipment: inv.shipmentId ? shipments.find((s) => s.id === inv.shipmentId) ?? null : null,
    pagos: payments.filter((p) => p.invoiceId === inv.id),
  };
}

export const documents: SutlDocument[] = [
  {
    id: 'doc-1', tenantId: 't-demo', shipmentId: 's3', tipo: 'bl', nombreArchivo: 'BL-MSCU9988776.pdf',
    urlArchivo: 'mock://documentos/BL-MSCU9988776.pdf', version: 1, subidoPorId: 'u-admin',
    createdAt: mesesAtras(1, 6),
  },
  {
    id: 'doc-2', tenantId: 't-demo', shipmentId: 's6', tipo: 'factura', nombreArchivo: 'Factura-CMDU4455667.pdf',
    urlArchivo: 'mock://documentos/Factura-CMDU4455667.pdf', version: 1, subidoPorId: 'u-operador',
    createdAt: mesesAtras(2, 19),
  },
];

export function documentExpanded(d: SutlDocument): SutlDocument {
  return {
    ...d,
    shipment: shipments.find((s) => s.id === d.shipmentId),
    subidoPor: d.subidoPorId ? users.find((u) => u.id === d.subidoPorId) ?? null : null,
  };
}

export const alerts: Alert[] = [
  { id: 'al-1', tenantId: 't-demo', shipmentId: null, tipo: 'retraso', condicion: { estado: 'en_transito', diasUmbral: 5 }, activo: true, createdAt: mesesAtras(3), updatedAt: mesesAtras(3) },
  { id: 'al-2', tenantId: 't-demo', shipmentId: null, tipo: 'documento_faltante', condicion: { tipoDocumento: 'bl', diasUmbral: 2 }, activo: true, createdAt: mesesAtras(3), updatedAt: mesesAtras(3) },
  { id: 'al-3', tenantId: 't-demo', shipmentId: null, tipo: 'llegada_proxima', condicion: { diasAntes: 7 }, activo: true, createdAt: mesesAtras(3), updatedAt: mesesAtras(3) },
];

export const notifications: AppNotification[] = [
  {
    id: 'notif-1', tenantId: 't-demo', userId: 'u-admin', canal: 'email', tipo: 'cambio_estado',
    asunto: 'Tu envío SUTL-DEMO-0001 cambió a "En tránsito"',
    mensaje: 'El envío SUTL-DEMO-0001 ahora está en tránsito hacia su destino.',
    estado: 'enviado', enviadoAt: diasAtras(2), createdAt: diasAtras(2),
  },
  {
    id: 'notif-2', tenantId: 't-demo', userId: 'u-admin', canal: 'email', tipo: 'documento_faltante',
    asunto: 'Recordatorio: falta el BL de SUTL-DEMO-0009',
    mensaje: 'Aún no se ha cargado el conocimiento de embarque (BL) para este envío.',
    estado: 'pendiente', enviadoAt: null, createdAt: diasAtras(1),
  },
];

export function notificationExpanded(n: AppNotification): AppNotification {
  return { ...n, user: n.userId ? users.find((u) => u.id === n.userId) ?? null : null };
}

export const reportCsvContent: Record<string, string> = {};

export const reports: Report[] = [
  {
    id: 'rep-1', tenantId: 't-demo', tipo: 'envios_por_estado', formato: 'csv',
    urlArchivo: 'mock://reportes/envios_por_estado.csv', generadoPorId: 'u-admin',
    createdAt: diasAtras(5),
  },
];
reportCsvContent['rep-1'] = buildCsvEnviosPorEstado();

export function reportExpanded(r: Report): Report {
  return { ...r, generadoPor: r.generadoPorId ? users.find((u) => u.id === r.generadoPorId) ?? null : null };
}

export function buildCsvEnviosPorEstado(): string {
  const porEstado: Record<string, number> = {};
  for (const s of shipments) {
    porEstado[s.estado] = (porEstado[s.estado] ?? 0) + 1;
  }
  const lines = ['estado,cantidad', ...Object.entries(porEstado).map(([k, v]) => `${k},${v}`)];
  return lines.join('\n');
}

export function buildCsvEnviosPorNaviera(): string {
  const lines = ['naviera,cantidad'];
  for (const c of carriers) {
    const cantidad = shipments.filter((s) => s.carrierId === c.id).length;
    if (cantidad > 0) lines.push(`${c.nombre},${cantidad}`);
  }
  return lines.join('\n');
}

export function buildCsvEnviosPorCliente(): string {
  const lines = ['destinatario,cantidad'];
  const porCliente: Record<string, number> = {};
  for (const s of shipments) {
    porCliente[s.destinatarioNombre] = (porCliente[s.destinatarioNombre] ?? 0) + 1;
  }
  for (const [k, v] of Object.entries(porCliente)) lines.push(`"${k}",${v}`);
  return lines.join('\n');
}
