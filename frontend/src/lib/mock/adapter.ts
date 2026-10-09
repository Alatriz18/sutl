import type { AxiosAdapter, AxiosRequestConfig, AxiosResponse } from 'axios';
import {
  Alert,
  AlertaEvaluada,
  AppNotification,
  Booking,
  Container,
  Invoice,
  Partner,
  Payment,
  Quote,
  Rate,
  Report,
  Shipment,
  TrackingEvent,
  TrackingPublicoResponse,
  User,
  Warehouse,
} from '@/types';
import * as db from './data';
import { nextId } from './data';

// Adapter de Axios que simula la API REST de SUTL completamente en el
// navegador, usando los datos de ./data.ts. Se activa con
// NEXT_PUBLIC_DEMO_MODE=true (ver src/lib/api.ts) para que el dashboard se
// vea poblado y funcional en despliegues sin backend (ej. Vercel preview).

const SESSION_KEY = 'sutl_demo_session';

interface DemoSession {
  userId: string;
}

function readSession(): DemoSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSession(session: DemoSession | null) {
  if (typeof window === 'undefined') return;
  try {
    if (session) window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // almacenamiento no disponible (modo privado, etc.) — la sesión demo
    // simplemente no sobrevive a un refresh, no es crítico.
  }
}

function currentUser(): User | null {
  const session = readSession();
  if (!session) return null;
  return db.users.find((u) => u.id === session.userId) ?? null;
}

function base64UrlEncode(obj: unknown): string {
  const json = JSON.stringify(obj);
  const b64 = typeof window === 'undefined' ? Buffer.from(json).toString('base64') : btoa(json);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function mintToken(user: User): string {
  const header = base64UrlEncode({ alg: 'none', typ: 'JWT' });
  const payload = base64UrlEncode({
    sub: user.id,
    tenantId: user.tenantId,
    rol: user.rol,
    email: user.email,
    exp: Math.floor(Date.now() / 1000) + 15 * 60,
  });
  return `${header}.${payload}.demo`;
}

class MockApiError extends Error {
  response: { status: number; data: { message: string } };
  constructor(status: number, message: string) {
    super(message);
    this.response = { status, data: { message } };
  }
}

function ok<T>(config: AxiosRequestConfig, data: T, status = 200): AxiosResponse<T> {
  return {
    data,
    status,
    statusText: 'OK',
    headers: {},
    config: config as AxiosResponse['config'],
  };
}

function parseBody(config: AxiosRequestConfig): Record<string, unknown> {
  if (!config.data) return {};
  if (typeof config.data === 'string') {
    try {
      return JSON.parse(config.data);
    } catch {
      return {};
    }
  }
  return config.data as Record<string, unknown>;
}

function match(pathname: string, pattern: RegExp) {
  return pathname.match(pattern);
}

function delay<T>(value: T, ms = 220): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function nowIso() {
  return new Date().toISOString();
}

function evaluarAlertas(): AlertaEvaluada[] {
  const DIA_MS = 86400000;
  return db.alerts
    .filter((a) => a.activo)
    .map((alerta) => {
      const c = alerta.condicion as Record<string, unknown>;
      let disparados: Shipment[] = [];
      if (alerta.tipo === 'retraso') {
        const umbral = Number(c.diasUmbral ?? 0);
        disparados = db.shipments.filter(
          (s) => s.estado === c.estado && Date.now() - new Date(s.updatedAt).getTime() > umbral * DIA_MS,
        );
      } else if (alerta.tipo === 'documento_faltante') {
        const umbral = Number(c.diasUmbral ?? 0);
        disparados = db.shipments.filter((s) => {
          const tieneDoc = db.documents.some((d) => d.shipmentId === s.id && d.tipo === c.tipoDocumento);
          return !tieneDoc && Date.now() - new Date(s.createdAt).getTime() > umbral * DIA_MS;
        });
      } else if (alerta.tipo === 'llegada_proxima') {
        const dias = Number(c.diasAntes ?? 0);
        disparados = db.shipments.filter((s) => {
          if (!s.fechaEstimadaLlegada) return false;
          const diff = new Date(s.fechaEstimadaLlegada).getTime() - Date.now();
          return diff > 0 && diff < dias * DIA_MS;
        });
      }
      return { alerta, disparados: disparados.map(db.shipmentWithCarrier) };
    });
}

export const mockAdapter: AxiosAdapter = async (config) => {
  const method = (config.method ?? 'get').toLowerCase();
  const url = new URL(config.url ?? '', 'http://demo.local');
  const path = url.pathname.replace(/^\/api/, '');
  const qs = url.searchParams;
  const body = parseBody(config);

  try {
    // --- AUTH ---
    if (method === 'post' && path === '/auth/login') {
      const email = String(body.email ?? '').trim().toLowerCase();
      const password = String(body.password ?? '');
      const expected = db.passwordsByEmail[email];
      const user = db.users.find((u) => u.email.toLowerCase() === email);
      if (!user || !expected || expected !== password) {
        throw new MockApiError(401, 'Credenciales inválidas.');
      }
      writeSession({ userId: user.id });
      return delay(ok(config, { accessToken: mintToken(user) }));
    }

    if (method === 'post' && path === '/auth/refresh') {
      const user = currentUser();
      if (!user) throw new MockApiError(401, 'Sesión no encontrada.');
      return delay(ok(config, { accessToken: mintToken(user) }), 80);
    }

    if (method === 'post' && path === '/auth/logout') {
      writeSession(null);
      return delay(ok(config, {}), 80);
    }

    // --- SHIPMENTS ---
    let m = match(path, /^\/shipments\/tracking\/(.+)$/);
    if (method === 'get' && m) {
      const codigo = decodeURIComponent(m[1]);
      const shipment = db.shipments.find((s) => s.codigoGuia === codigo);
      if (!shipment) throw new MockApiError(404, 'No se encontró un envío con ese código.');
      const eventos = db.trackingEventsByShipment[shipment.id] ?? [];
      const res: TrackingPublicoResponse = {
        codigoGuia: shipment.codigoGuia,
        estado: shipment.estado,
        origen: shipment.origen,
        destino: shipment.destino,
        destinatarioNombre: shipment.destinatarioNombre,
        createdAt: shipment.createdAt,
        eventos: [...eventos].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
      };
      return delay(ok(config, res));
    }

    if (method === 'get' && path === '/shipments') {
      return delay(ok(config, db.shipments.map(db.shipmentWithCarrier)));
    }

    m = match(path, /^\/shipments\/([^/]+)$/);
    if (method === 'get' && m) {
      const shipment = db.shipments.find((s) => s.id === m![1]);
      if (!shipment) throw new MockApiError(404, 'Envío no encontrado.');
      return delay(ok(config, db.shipmentWithCarrier(shipment)));
    }

    if (method === 'post' && path === '/shipments') {
      const numero = db.shipments.length + 1;
      const shipment: Shipment = {
        id: nextId('s'),
        tenantId: currentUser()?.tenantId ?? 't-demo',
        codigoGuia: `SUTL-${new Date().getFullYear()}-${String(numero).padStart(4, '0')}`,
        tipo: (body.tipo as Shipment['tipo']) ?? 'exportacion',
        modo: (body.modo as Shipment['modo']) ?? 'maritimo',
        carrierId: (body.carrierId as string) || null,
        bookingId: (body.bookingId as string) || null,
        containerId: null,
        referenciaDocumento: (body.referenciaDocumento as string) || null,
        remitenteNombre: String(body.remitenteNombre ?? ''),
        destinatarioNombre: String(body.destinatarioNombre ?? ''),
        destinatarioEmail: (body.destinatarioEmail as string) || null,
        origen: String(body.origen ?? ''),
        destino: String(body.destino ?? ''),
        puertoOrigen: (body.puertoOrigen as string) || null,
        puertoDestino: (body.puertoDestino as string) || null,
        pesoKg: body.pesoKg != null ? Number(body.pesoKg) : null,
        fechaEstimadaSalida: null,
        fechaEstimadaLlegada: null,
        estado: 'creado',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      db.shipments.push(shipment);
      db.trackingEventsByShipment[shipment.id] = [
        {
          _id: nextId('te'),
          shipmentId: shipment.id,
          tenantId: shipment.tenantId,
          codigoGuia: shipment.codigoGuia,
          estado: 'creado',
          descripcion: 'Envío registrado en el sistema.',
          responsable: currentUser()?.nombre ?? 'Usuario demo',
          timestamp: nowIso(),
        },
      ];
      if (body.bookingId) {
        const booking = db.bookings.find((b) => b.id === body.bookingId);
        if (booking) booking.estado = 'convertida';
      }
      return delay(ok(config, db.shipmentWithCarrier(shipment)), 300);
    }

    // --- TRACKING EVENTS ---
    m = match(path, /^\/tracking-events\/shipment\/([^/]+)$/);
    if (method === 'get' && m) {
      const eventos = db.trackingEventsByShipment[m[1]] ?? [];
      return delay(ok(config, [...eventos].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())));
    }

    if (method === 'post' && path === '/tracking-events') {
      const shipmentId = String(body.shipmentId ?? '');
      const shipment = db.shipments.find((s) => s.id === shipmentId);
      if (!shipment) throw new MockApiError(404, 'Envío no encontrado.');
      const evento: TrackingEvent = {
        _id: nextId('te'),
        shipmentId,
        tenantId: shipment.tenantId,
        codigoGuia: shipment.codigoGuia,
        estado: (body.estado as Shipment['estado']) ?? shipment.estado,
        ubicacion: (body.ubicacion as string) || undefined,
        descripcion: (body.descripcion as string) || undefined,
        responsable: currentUser()?.nombre ?? 'Usuario demo',
        timestamp: nowIso(),
      };
      db.trackingEventsByShipment[shipmentId] = [...(db.trackingEventsByShipment[shipmentId] ?? []), evento];
      shipment.estado = evento.estado;
      shipment.updatedAt = nowIso();
      return delay(ok(config, evento), 280);
    }

    // --- CARRIERS ---
    if (method === 'get' && path === '/carriers') {
      return delay(ok(config, db.carriers));
    }

    // --- TENANTS ---
    if (method === 'get' && path === '/tenants') {
      return delay(ok(config, db.tenants));
    }
    if (method === 'post' && path === '/tenants') {
      const tenant = {
        id: nextId('t'),
        nombre: String(body.nombre ?? ''),
        ruc: (body.ruc as string) || null,
        plan: (body.plan as string) ?? 'trial',
        activo: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      db.tenants.push(tenant);
      return delay(ok(config, tenant), 280);
    }
    m = match(path, /^\/tenants\/([^/]+)$/);
    if (method === 'patch' && m) {
      const tenant = db.tenants.find((t) => t.id === m![1]);
      if (!tenant) throw new MockApiError(404, 'Tenant no encontrado.');
      Object.assign(tenant, body, { updatedAt: nowIso() });
      return delay(ok(config, tenant));
    }
    if (method === 'delete' && m) {
      const tenant = db.tenants.find((t) => t.id === m![1]);
      if (!tenant) throw new MockApiError(404, 'Tenant no encontrado.');
      tenant.activo = false;
      tenant.updatedAt = nowIso();
      return delay(ok(config, tenant));
    }

    // --- USERS ---
    if (method === 'get' && path === '/users') {
      const session = currentUser();
      const list = session?.rol === 'super_admin' ? db.users : db.users.filter((u) => u.tenantId === (session?.tenantId ?? 't-demo'));
      return delay(ok(config, list));
    }
    if (method === 'post' && path === '/users') {
      if (db.users.some((u) => u.email.toLowerCase() === String(body.email ?? '').toLowerCase())) {
        throw new MockApiError(409, 'Ya existe un usuario con ese email.');
      }
      const user: User = {
        id: nextId('u'),
        tenantId: currentUser()?.tenantId ?? 't-demo',
        email: String(body.email ?? ''),
        nombre: String(body.nombre ?? ''),
        rol: (body.rol as User['rol']) ?? 'operador',
        activo: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      db.users.push(user);
      db.passwordsByEmail[user.email.toLowerCase()] = String(body.password ?? '');
      return delay(ok(config, user), 280);
    }
    m = match(path, /^\/users\/([^/]+)$/);
    if (method === 'patch' && m) {
      const user = db.users.find((u) => u.id === m![1]);
      if (!user) throw new MockApiError(404, 'Usuario no encontrado.');
      Object.assign(user, body, { updatedAt: nowIso() });
      return delay(ok(config, user));
    }
    if (method === 'delete' && m) {
      const user = db.users.find((u) => u.id === m![1]);
      if (!user) throw new MockApiError(404, 'Usuario no encontrado.');
      user.activo = false;
      user.updatedAt = nowIso();
      return delay(ok(config, user));
    }

    // --- PARTNERS ---
    if (method === 'get' && path === '/partners') {
      const tipo = qs.get('tipo');
      const list = tipo ? db.partners.filter((p) => p.tipo === tipo) : db.partners;
      return delay(ok(config, list));
    }
    if (method === 'post' && path === '/partners') {
      const partner: Partner = {
        id: nextId('p'),
        tenantId: currentUser()?.tenantId ?? 't-demo',
        tipo: (body.tipo as Partner['tipo']) ?? 'cliente',
        nombre: String(body.nombre ?? ''),
        taxId: (body.taxId as string) || null,
        email: (body.email as string) || null,
        telefono: (body.telefono as string) || null,
        direccion: (body.direccion as string) || null,
        contactoNombre: (body.contactoNombre as string) || null,
        activo: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      db.partners.push(partner);
      return delay(ok(config, partner), 280);
    }

    // --- QUOTES ---
    if (method === 'get' && path === '/quotes') {
      return delay(ok(config, db.quotes.map(db.quoteExpanded)));
    }
    m = match(path, /^\/quotes\/([^/]+)$/);
    if (method === 'get' && m) {
      const quote = db.quotes.find((q) => q.id === m![1]);
      if (!quote) throw new MockApiError(404, 'Cotización no encontrada.');
      return delay(ok(config, db.quoteExpanded(quote)));
    }
    if (method === 'post' && path === '/quotes') {
      const quote: Quote = {
        id: nextId('q'),
        tenantId: currentUser()?.tenantId ?? 't-demo',
        numero: `COT-${nextId('').replace('-', '')}`,
        clienteId: String(body.clienteId ?? ''),
        tipo: (body.tipo as Quote['tipo']) ?? 'exportacion',
        modo: (body.modo as Quote['modo']) ?? 'maritimo',
        carrierId: (body.carrierId as string) || null,
        origen: String(body.origen ?? ''),
        destino: String(body.destino ?? ''),
        pesoKg: body.pesoKg != null ? Number(body.pesoKg) : null,
        volumenM3: null,
        tarifaEstimada: body.tarifaEstimada != null ? Number(body.tarifaEstimada) : null,
        moneda: 'USD',
        estado: 'borrador',
        validoHasta: null,
        notas: (body.notas as string) || null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      db.quotes.push(quote);
      return delay(ok(config, db.quoteExpanded(quote)), 280);
    }

    // --- BOOKINGS ---
    if (method === 'get' && path === '/bookings') {
      return delay(ok(config, db.bookings.map(db.bookingExpanded)));
    }
    m = match(path, /^\/bookings\/([^/]+)\/convertir-a-envio$/);
    if (method === 'post' && m) {
      const booking = db.bookings.find((b) => b.id === m![1]);
      if (!booking) throw new MockApiError(404, 'Reserva no encontrada.');
      const numero = db.shipments.length + 1;
      const shipment: Shipment = {
        id: nextId('s'),
        tenantId: booking.tenantId,
        codigoGuia: `SUTL-${new Date().getFullYear()}-${String(numero).padStart(4, '0')}`,
        tipo: booking.tipo,
        modo: booking.modo,
        carrierId: booking.carrierId,
        bookingId: booking.id,
        containerId: null,
        referenciaDocumento: null,
        remitenteNombre: db.partners.find((p) => p.id === booking.clienteId)?.nombre ?? 'Cliente',
        destinatarioNombre: booking.destino,
        destinatarioEmail: null,
        origen: booking.origen,
        destino: booking.destino,
        puertoOrigen: null,
        puertoDestino: null,
        pesoKg: null,
        fechaEstimadaSalida: null,
        fechaEstimadaLlegada: null,
        estado: 'creado',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      db.shipments.push(shipment);
      db.trackingEventsByShipment[shipment.id] = [
        {
          _id: nextId('te'),
          shipmentId: shipment.id,
          tenantId: shipment.tenantId,
          codigoGuia: shipment.codigoGuia,
          estado: 'creado',
          descripcion: 'Envío generado a partir de una reserva confirmada.',
          responsable: currentUser()?.nombre ?? 'Usuario demo',
          timestamp: nowIso(),
        },
      ];
      booking.estado = 'convertida';
      return delay(ok(config, shipment), 320);
    }
    if (method === 'post' && path === '/bookings') {
      const booking: Booking = {
        id: nextId('b'),
        tenantId: currentUser()?.tenantId ?? 't-demo',
        quoteId: (body.quoteId as string) || null,
        clienteId: String(body.clienteId ?? ''),
        tipo: (body.tipo as Booking['tipo']) ?? 'exportacion',
        modo: (body.modo as Booking['modo']) ?? 'maritimo',
        carrierId: (body.carrierId as string) || null,
        origen: String(body.origen ?? ''),
        destino: String(body.destino ?? ''),
        fechaEstimadaCarga: (body.fechaEstimadaCarga as string) || null,
        estado: 'pendiente',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      db.bookings.push(booking);
      if (booking.quoteId) {
        const quote = db.quotes.find((q) => q.id === booking.quoteId);
        if (quote) quote.estado = 'convertida';
      }
      return delay(ok(config, db.bookingExpanded(booking)), 280);
    }

    // --- RATES ---
    if (method === 'get' && path === '/rates') {
      return delay(ok(config, db.rates.map(db.rateExpanded)));
    }
    if (method === 'post' && path === '/rates') {
      const rate: Rate = {
        id: nextId('r'),
        tenantId: currentUser()?.tenantId ?? 't-demo',
        carrierId: String(body.carrierId ?? ''),
        origen: String(body.origen ?? ''),
        destino: String(body.destino ?? ''),
        modo: (body.modo as Rate['modo']) ?? 'maritimo',
        tipo: (body.tipo as Rate['tipo']) ?? 'exportacion',
        unidad: String(body.unidad ?? 'contenedor_40'),
        precioBase: Number(body.precioBase ?? 0),
        moneda: 'USD',
        vigenteDesde: nowIso(),
        vigenteHasta: null,
        activo: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      db.rates.push(rate);
      return delay(ok(config, db.rateExpanded(rate)), 280);
    }

    // --- CONTRACTS ---
    if (method === 'get' && path === '/contracts') {
      return delay(ok(config, db.contracts.map(db.contractExpanded)));
    }

    // --- INVOICES ---
    if (method === 'get' && path === '/invoices') {
      return delay(ok(config, db.invoices.map(db.invoiceExpanded)));
    }
    if (method === 'post' && path === '/invoices') {
      const invoice: Invoice = {
        id: nextId('inv'),
        tenantId: currentUser()?.tenantId ?? 't-demo',
        tipo: (body.tipo as Invoice['tipo']) ?? 'cxc',
        numero: `FAC-${(body.tipo as string)?.toUpperCase() ?? 'CXC'}-${nextId('').replace('-', '')}`,
        partnerId: String(body.partnerId ?? ''),
        shipmentId: null,
        montoTotal: Number(body.montoTotal ?? 0),
        moneda: 'USD',
        estado: 'pendiente',
        fechaEmision: nowIso(),
        fechaVencimiento: (body.fechaVencimiento as string) || null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      db.invoices.push(invoice);
      return delay(ok(config, db.invoiceExpanded(invoice)), 280);
    }
    m = match(path, /^\/invoices\/([^/]+)\/pagos$/);
    if (method === 'post' && m) {
      const invoice = db.invoices.find((i) => i.id === m![1]);
      if (!invoice) throw new MockApiError(404, 'Factura no encontrada.');
      const pago: Payment = {
        id: nextId('pay'),
        tenantId: invoice.tenantId,
        invoiceId: invoice.id,
        monto: Number(body.monto ?? 0),
        metodo: (body.metodo as string) || null,
        referencia: (body.referencia as string) || null,
        fecha: nowIso(),
        createdAt: nowIso(),
      };
      db.payments.push(pago);
      const pagado = db.payments.filter((p) => p.invoiceId === invoice.id).reduce((acc, p) => acc + p.monto, 0);
      if (pagado >= invoice.montoTotal) invoice.estado = 'pagada';
      invoice.updatedAt = nowIso();
      return delay(ok(config, db.invoiceExpanded(invoice)), 280);
    }

    // --- CONTAINERS ---
    if (method === 'get' && path === '/containers') {
      return delay(ok(config, db.containers.map(db.containerExpanded)));
    }
    if (method === 'post' && path === '/containers') {
      const container: Container = {
        id: nextId('cnt'),
        tenantId: currentUser()?.tenantId ?? 't-demo',
        numeroContenedor: String(body.numeroContenedor ?? ''),
        tipo: (body.tipo as string) || null,
        carrierId: (body.carrierId as string) || null,
        origen: String(body.origen ?? ''),
        destino: String(body.destino ?? ''),
        estado: 'abierto',
        capacidadM3: body.capacidadM3 != null ? Number(body.capacidadM3) : null,
        fechaCierre: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      db.containers.push(container);
      return delay(ok(config, db.containerExpanded(container)), 280);
    }
    m = match(path, /^\/containers\/([^/]+)\/envios\/([^/]+)$/);
    if (method === 'post' && m) {
      const container = db.containers.find((c) => c.id === m![1]);
      const shipment = db.shipments.find((s) => s.id === m![2]);
      if (!container || !shipment) throw new MockApiError(404, 'Contenedor o envío no encontrado.');
      shipment.containerId = container.id;
      shipment.updatedAt = nowIso();
      return delay(ok(config, db.containerExpanded(container)), 260);
    }

    // --- WAREHOUSES ---
    if (method === 'get' && path === '/warehouses') {
      return delay(ok(config, db.warehouses.map(db.warehouseExpanded)));
    }
    if (method === 'post' && path === '/warehouses') {
      const warehouse: Warehouse = {
        id: nextId('wh'),
        tenantId: currentUser()?.tenantId ?? 't-demo',
        nombre: String(body.nombre ?? ''),
        direccion: (body.direccion as string) || null,
        activo: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      db.warehouses.push(warehouse);
      return delay(ok(config, db.warehouseExpanded(warehouse)), 280);
    }

    // --- INVENTORY ITEMS ---
    if (method === 'get' && path === '/inventory-items') {
      return delay(ok(config, db.inventoryItems.map(db.inventoryItemExpanded)));
    }
    if (method === 'post' && path === '/inventory-items') {
      const item = {
        id: nextId('inv-item'),
        tenantId: currentUser()?.tenantId ?? 't-demo',
        warehouseId: String(body.warehouseId ?? ''),
        ubicacionId: null,
        shipmentId: null,
        sku: (body.sku as string) || null,
        descripcion: String(body.descripcion ?? ''),
        cantidad: Number(body.cantidad ?? 0),
        unidad: (body.unidad as string) || 'unidad',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      db.inventoryItems.push(item);
      return delay(ok(config, db.inventoryItemExpanded(item)), 280);
    }

    // --- VEHICLES / DRIVERS ---
    if (method === 'get' && path === '/vehicles') {
      return delay(ok(config, db.vehicles.map(db.vehicleExpanded)));
    }
    if (method === 'post' && path === '/vehicles') {
      const vehicle = {
        id: nextId('veh'),
        tenantId: currentUser()?.tenantId ?? 't-demo',
        placa: String(body.placa ?? ''),
        tipo: String(body.tipo ?? ''),
        capacidadKg: body.capacidadKg != null ? Number(body.capacidadKg) : null,
        estado: 'disponible' as const,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      db.vehicles.push(vehicle);
      return delay(ok(config, db.vehicleExpanded(vehicle)), 280);
    }
    if (method === 'get' && path === '/drivers') {
      return delay(ok(config, db.drivers));
    }
    if (method === 'post' && path === '/drivers') {
      const driver = {
        id: nextId('drv'),
        tenantId: currentUser()?.tenantId ?? 't-demo',
        nombre: String(body.nombre ?? ''),
        licencia: String(body.licencia ?? ''),
        telefono: (body.telefono as string) || null,
        activo: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      db.drivers.push(driver);
      return delay(ok(config, driver), 280);
    }

    // --- DOCUMENTS ---
    if (method === 'get' && path === '/documents') {
      return delay(ok(config, db.documents.map(db.documentExpanded)));
    }
    if (method === 'post' && path === '/documents') {
      const formData = config.data as FormData;
      const shipmentId = String(formData.get('shipmentId') ?? '');
      const tipo = String(formData.get('tipo') ?? 'otro');
      const file = formData.get('file') as File | null;
      const doc = {
        id: nextId('doc'),
        tenantId: currentUser()?.tenantId ?? 't-demo',
        shipmentId,
        tipo: tipo as SutlDocumentTipo,
        nombreArchivo: file?.name ?? `documento-${Date.now()}.pdf`,
        urlArchivo: `mock://documentos/${file?.name ?? 'documento.pdf'}`,
        version: 1,
        subidoPorId: currentUser()?.id ?? null,
        createdAt: nowIso(),
      };
      db.documents.push(doc);
      return delay(ok(config, db.documentExpanded(doc)), 400);
    }
    m = match(path, /^\/documents\/([^/]+)\/download$/);
    if (method === 'get' && m) {
      const doc = db.documents.find((d) => d.id === m![1]);
      if (!doc) throw new MockApiError(404, 'Documento no encontrado.');
      const blob = new Blob(
        [`Documento simulado — modo demo de SUTL.\nArchivo: ${doc.nombreArchivo}\nTipo: ${doc.tipo}\n`],
        { type: 'application/pdf' },
      );
      return delay(ok(config, blob), 200);
    }

    // --- ALERTS ---
    if (method === 'get' && path === '/alerts/evaluar') {
      return delay(ok(config, evaluarAlertas()));
    }
    if (method === 'get' && path === '/alerts') {
      return delay(ok(config, db.alerts));
    }
    if (method === 'post' && path === '/alerts') {
      const alerta: Alert = {
        id: nextId('al'),
        tenantId: currentUser()?.tenantId ?? 't-demo',
        shipmentId: null,
        tipo: (body.tipo as Alert['tipo']) ?? 'personalizada',
        condicion: (body.condicion as Record<string, unknown>) ?? {},
        activo: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      db.alerts.push(alerta);
      return delay(ok(config, alerta), 260);
    }
    m = match(path, /^\/alerts\/([^/]+)$/);
    if (method === 'patch' && m) {
      const alerta = db.alerts.find((a) => a.id === m![1]);
      if (!alerta) throw new MockApiError(404, 'Alerta no encontrada.');
      Object.assign(alerta, body, { updatedAt: nowIso() });
      return delay(ok(config, alerta));
    }

    // --- NOTIFICATIONS ---
    if (method === 'get' && path === '/notifications') {
      return delay(ok(config, db.notifications.map(db.notificationExpanded)));
    }
    if (method === 'post' && path === '/notifications') {
      const notif: AppNotification = {
        id: nextId('notif'),
        tenantId: currentUser()?.tenantId ?? 't-demo',
        userId: currentUser()?.id ?? null,
        canal: (body.canal as AppNotification['canal']) ?? 'email',
        tipo: String(body.tipo ?? 'personalizada'),
        asunto: String(body.asunto ?? ''),
        mensaje: String(body.mensaje ?? ''),
        estado: 'pendiente',
        enviadoAt: null,
        createdAt: nowIso(),
      };
      db.notifications.push(notif);
      return delay(ok(config, db.notificationExpanded(notif)), 260);
    }
    m = match(path, /^\/notifications\/([^/]+)\/marcar-enviada$/);
    if (method === 'patch' && m) {
      const notif = db.notifications.find((n) => n.id === m![1]);
      if (!notif) throw new MockApiError(404, 'Notificación no encontrada.');
      notif.estado = 'enviado';
      notif.enviadoAt = nowIso();
      return delay(ok(config, db.notificationExpanded(notif)));
    }

    // --- REPORTS ---
    if (method === 'get' && path === '/reports') {
      return delay(ok(config, db.reports.map(db.reportExpanded)));
    }
    if (method === 'post' && path === '/reports') {
      const tipo = String(body.tipo ?? 'envios_por_estado');
      const formato = String(body.formato ?? 'csv');
      const report: Report = {
        id: nextId('rep'),
        tenantId: currentUser()?.tenantId ?? 't-demo',
        tipo,
        formato,
        urlArchivo: formato === 'csv' ? `mock://reportes/${tipo}.csv` : null,
        generadoPorId: currentUser()?.id ?? null,
        createdAt: nowIso(),
      };
      if (formato === 'csv') {
        const csv =
          tipo === 'envios_por_naviera'
            ? db.buildCsvEnviosPorNaviera()
            : tipo === 'envios_por_cliente'
              ? db.buildCsvEnviosPorCliente()
              : db.buildCsvEnviosPorEstado();
        db.reportCsvContent[report.id] = csv;
      }
      db.reports.unshift(report);
      return delay(ok(config, db.reportExpanded(report)), 420);
    }
    m = match(path, /^\/reports\/([^/]+)\/download$/);
    if (method === 'get' && m) {
      const report = db.reports.find((r) => r.id === m![1]);
      const csv = report ? db.reportCsvContent[report.id] : undefined;
      if (!report || !csv) throw new MockApiError(404, 'Reporte no encontrado o sin archivo.');
      const blob = new Blob([csv], { type: 'text/csv' });
      return delay(ok(config, blob), 200);
    }

    throw new MockApiError(404, `(demo) Endpoint no implementado en el modo demo: ${method.toUpperCase()} ${path}`);
  } catch (err) {
    if (err instanceof MockApiError) {
      return Promise.reject(err);
    }
    throw err;
  }
};

type SutlDocumentTipo = 'bl' | 'awb' | 'factura' | 'pedimento' | 'packing_list' | 'otro';
