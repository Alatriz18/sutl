import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './test-app';

// Aislamiento multi-tenant en las REFERENCIAS: el tenant B no puede crear ni
// editar registros propios que apunten a un cliente, envío, conductor,
// usuario, cotización o ubicación del tenant A. Antes de este control la
// respuesta además incluía (vía `include`) los datos del registro ajeno.
// La respuesta es la misma que para un ID inexistente, para no revelar si el
// ID existe en otro tenant.
const SUPER_ADMIN = { email: 'admin@sutl.dev', password: 'SutlAdmin2026!' };
const PASSWORD = 'PasswordSeguro123';
const UUID_INEXISTENTE = '00000000-0000-4000-8000-000000000000';

describe('Aislamiento multi-tenant en referencias (e2e)', () => {
  let app: INestApplication;
  const suffix = Date.now();

  let tokenA: string;
  let tokenB: string;

  // Registros del tenant A
  let clienteA: string;
  let shipmentA: string;
  let driverA: string;
  let userA: string;
  let quoteA: string;
  let warehouseA: string;
  let ubicacionA: string;

  // Registros propios del tenant B
  let clienteB: string;
  let shipmentB: string;
  let vehicleB: string;
  let driverB: string;
  let warehouseB: string;
  let quoteB: string;
  let bookingB: string;
  let alertB: string;

  const http = () => request(app.getHttpServer());
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function login(email: string, password: string) {
    const res = await http().post('/api/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    return res.body.accessToken as string;
  }

  async function crearTenantConUsuario(superAdminToken: string, nombre: string, email: string) {
    const tenant = await http().post('/api/tenants').set(auth(superAdminToken)).send({ nombre, plan: 'trial' });
    expect(tenant.status).toBe(201);
    const user = await http()
      .post('/api/auth/register')
      .set(auth(superAdminToken))
      .send({ tenantId: tenant.body.id, email, password: PASSWORD, nombre });
    expect(user.status).toBe(201);
    return { token: await login(email, PASSWORD), userId: user.body.id as string };
  }

  async function crear(token: string, ruta: string, body: Record<string, unknown>) {
    const res = await http().post(ruta).set(auth(token)).send(body);
    expect(res.status).toBe(201);
    return res.body.id as string;
  }

  const envio = { tipo: 'importacion', modo: 'maritimo', remitenteNombre: 'R', destinatarioNombre: 'D', origen: 'Shanghai', destino: 'Guayaquil' };
  const cotizacion = { tipo: 'importacion', modo: 'maritimo', origen: 'Shanghai', destino: 'Guayaquil' };

  // Verifica que la petición se rechace como "no encontrado" y que la
  // respuesta no filtre el nombre secreto del cliente de A.
  function expectRechazo(res: request.Response) {
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain('Cliente secreto A');
  }

  beforeAll(async () => {
    app = await createTestApp();
    const superAdminToken = await login(SUPER_ADMIN.email, SUPER_ADMIN.password);
    const a = await crearTenantConUsuario(superAdminToken, `Tenant Ref A ${suffix}`, `ref-a-${suffix}@ref-test.com`);
    const b = await crearTenantConUsuario(superAdminToken, `Tenant Ref B ${suffix}`, `ref-b-${suffix}@ref-test.com`);
    tokenA = a.token;
    tokenB = b.token;
    userA = a.userId;

    clienteA = await crear(tokenA, '/api/partners', { tipo: 'cliente', nombre: `Cliente secreto A ${suffix}` });
    shipmentA = await crear(tokenA, '/api/shipments', envio);
    driverA = await crear(tokenA, '/api/drivers', { nombre: 'Conductor A', licencia: 'LIC-A' });
    quoteA = await crear(tokenA, '/api/quotes', { ...cotizacion, clienteId: clienteA });
    warehouseA = await crear(tokenA, '/api/warehouses', { nombre: 'Bodega A' });
    ubicacionA = await crear(tokenA, `/api/warehouses/${warehouseA}/locations`, { codigo: 'A-01' });

    clienteB = await crear(tokenB, '/api/partners', { tipo: 'cliente', nombre: `Cliente B ${suffix}` });
    shipmentB = await crear(tokenB, '/api/shipments', envio);
    vehicleB = await crear(tokenB, '/api/vehicles', { placa: `B-${suffix}`, tipo: 'camion' });
    driverB = await crear(tokenB, '/api/drivers', { nombre: 'Conductor B', licencia: 'LIC-B' });
    warehouseB = await crear(tokenB, '/api/warehouses', { nombre: 'Bodega B' });
    quoteB = await crear(tokenB, '/api/quotes', { ...cotizacion, clienteId: clienteB });
    bookingB = await crear(tokenB, '/api/bookings', { ...cotizacion, clienteId: clienteB });
    alertB = await crear(tokenB, '/api/alerts', { tipo: 'personalizada', condicion: {} });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('cotizaciones y reservas', () => {
    it('B no puede cotizar a un cliente de A', async () => {
      expectRechazo(await http().post('/api/quotes').set(auth(tokenB)).send({ ...cotizacion, clienteId: clienteA }));
    });

    it('B no puede reasignar su cotización a un cliente de A', async () => {
      expectRechazo(await http().patch(`/api/quotes/${quoteB}`).set(auth(tokenB)).send({ clienteId: clienteA }));
    });

    it('B no puede crear una reserva para un cliente de A', async () => {
      expectRechazo(await http().post('/api/bookings').set(auth(tokenB)).send({ ...cotizacion, clienteId: clienteA }));
    });

    it('B no puede crear una reserva desde una cotización de A', async () => {
      expectRechazo(
        await http().post('/api/bookings').set(auth(tokenB)).send({ ...cotizacion, clienteId: clienteB, quoteId: quoteA }),
      );
    });

    it('B no puede reasignar su reserva a un cliente o cotización de A', async () => {
      expectRechazo(await http().patch(`/api/bookings/${bookingB}`).set(auth(tokenB)).send({ clienteId: clienteA }));
      expectRechazo(await http().patch(`/api/bookings/${bookingB}`).set(auth(tokenB)).send({ quoteId: quoteA }));
    });

    it('con referencias propias todo sigue funcionando', async () => {
      const res = await http()
        .post('/api/bookings')
        .set(auth(tokenB))
        .send({ ...cotizacion, clienteId: clienteB, quoteId: quoteB });
      expect(res.status).toBe(201);
      expect(res.body.cliente.id).toBe(clienteB);
    });
  });

  describe('facturas', () => {
    it('B no puede facturar a una contraparte de A', async () => {
      expectRechazo(
        await http().post('/api/invoices').set(auth(tokenB)).send({ tipo: 'cxc', partnerId: clienteA, montoTotal: 100 }),
      );
    });

    it('B no puede asociar su factura a un envío de A', async () => {
      expectRechazo(
        await http()
          .post('/api/invoices')
          .set(auth(tokenB))
          .send({ tipo: 'cxc', partnerId: clienteB, shipmentId: shipmentA, montoTotal: 100 }),
      );
    });
  });

  describe('alertas', () => {
    it('B no puede crear ni mover una alerta hacia un envío de A', async () => {
      expectRechazo(
        await http().post('/api/alerts').set(auth(tokenB)).send({ tipo: 'personalizada', shipmentId: shipmentA, condicion: {} }),
      );
      expectRechazo(await http().patch(`/api/alerts/${alertB}`).set(auth(tokenB)).send({ shipmentId: shipmentA }));
    });
  });

  describe('flota', () => {
    it('B no puede asignar a su vehículo un conductor de A', async () => {
      expectRechazo(
        await http().post('/api/vehicle-assignments').set(auth(tokenB)).send({ vehicleId: vehicleB, driverId: driverA }),
      );
    });

    it('B no puede asignar su vehículo a un envío de A', async () => {
      expectRechazo(
        await http()
          .post('/api/vehicle-assignments')
          .set(auth(tokenB))
          .send({ vehicleId: vehicleB, driverId: driverB, shipmentId: shipmentA }),
      );
    });
  });

  describe('notificaciones', () => {
    it('B no puede crear una notificación dirigida a un usuario de A', async () => {
      const res = await http()
        .post('/api/notifications')
        .set(auth(tokenB))
        .send({ canal: 'email', tipo: 'aviso', asunto: 'Hola', mensaje: 'Mensaje', userId: userA });
      expect(res.status).toBe(404);
      expect(JSON.stringify(res.body)).not.toContain(`ref-a-${suffix}`);
    });
  });

  describe('inventario', () => {
    it('B no puede ubicar un ítem en una ubicación de la bodega de A', async () => {
      expectRechazo(
        await http()
          .post('/api/inventory-items')
          .set(auth(tokenB))
          .send({ warehouseId: warehouseB, ubicacionId: ubicacionA, descripcion: 'Caja', cantidad: 1 }),
      );
    });

    it('la ubicación debe pertenecer a la bodega indicada, incluso dentro del mismo tenant', async () => {
      const otraBodegaA = await crear(tokenA, '/api/warehouses', { nombre: 'Bodega A2' });
      expectRechazo(
        await http()
          .post('/api/inventory-items')
          .set(auth(tokenA))
          .send({ warehouseId: otraBodegaA, ubicacionId: ubicacionA, descripcion: 'Caja', cantidad: 1 }),
      );
    });

    it('B no puede asociar un ítem a un envío de A', async () => {
      expectRechazo(
        await http()
          .post('/api/inventory-items')
          .set(auth(tokenB))
          .send({ warehouseId: warehouseB, shipmentId: shipmentA, descripcion: 'Caja', cantidad: 1 }),
      );
    });
  });

  describe('transportistas (catálogo global)', () => {
    it('un carrierId inexistente responde 404, no un error 500', async () => {
      const res = await http().post('/api/shipments').set(auth(tokenB)).send({ ...envio, carrierId: UUID_INEXISTENTE });
      expect(res.status).toBe(404);
    });

    it('B sí puede usar un transportista del catálogo global', async () => {
      const carriers = await http().get('/api/carriers').set(auth(tokenB));
      expect(carriers.status).toBe(200);
      expect(carriers.body.length).toBeGreaterThan(0);
      const res = await http().post('/api/shipments').set(auth(tokenB)).send({ ...envio, carrierId: carriers.body[0].id });
      expect(res.status).toBe(201);
    });
  });

  it('los registros de B siguen intactos tras los intentos rechazados', async () => {
    const quote = await http().get(`/api/quotes/${quoteB}`).set(auth(tokenB));
    expect(quote.body.clienteId).toBe(clienteB);
    const booking = await http().get(`/api/bookings/${bookingB}`).set(auth(tokenB));
    expect(booking.body.clienteId).toBe(clienteB);
    expect(booking.body.quoteId).toBeNull();
    const alerts = await http().get('/api/alerts').set(auth(tokenB));
    const alert = alerts.body.find((a: { id: string }) => a.id === alertB);
    expect(alert.shipmentId).toBeNull();
    expect(alert.shipment).toBeNull();
    // El envío propio de B sigue siendo asignable a su alerta.
    const propia = await http().patch(`/api/alerts/${alertB}`).set(auth(tokenB)).send({ shipmentId: shipmentB });
    expect(propia.status).toBe(200);
  });
});
