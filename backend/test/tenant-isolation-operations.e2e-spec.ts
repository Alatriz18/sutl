import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './test-app';

// Tercera tanda del mismo patrón (ver tenant-isolation.e2e-spec.ts y
// tenant-isolation-financial.e2e-spec.ts): cubre los módulos de operación
// diaria — cotizaciones, reservas, contenedores, flota, bodega/inventario,
// alertas, notificaciones y eventos de tracking — que recibieron el mismo
// fix de "repetir tenantId en el where del update/delete real".
const SUPER_ADMIN = { email: 'admin@sutl.dev', password: 'SutlAdmin2026!' };

describe('Aislamiento multi-tenant — módulos de operación (e2e)', () => {
  let app: INestApplication;
  const suffix = Date.now();

  let tokenA: string;
  let tokenB: string;
  let carrierId: string;
  let partnerAId: string;
  let shipmentAId: string;

  let quoteAId: string;
  let bookingAId: string;
  let containerAId: string;
  let vehicleAId: string;
  let driverAId: string;
  let assignmentAId: string;
  let warehouseAId: string;
  let itemAId: string;
  let alertAId: string;
  let notificationAId: string;

  async function login(email: string, password: string) {
    const res = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    return res.body.accessToken as string;
  }

  beforeAll(async () => {
    app = await createTestApp();
    const superAdminToken = await login(SUPER_ADMIN.email, SUPER_ADMIN.password);

    const tenantA = await request(app.getHttpServer())
      .post('/api/tenants')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ nombre: `Tenant Operacion A ${suffix}`, plan: 'trial' });
    expect(tenantA.status).toBe(201);
    const tenantAId = tenantA.body.id;

    const tenantB = await request(app.getHttpServer())
      .post('/api/tenants')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ nombre: `Tenant Operacion B ${suffix}`, plan: 'trial' });
    expect(tenantB.status).toBe(201);
    const tenantBId = tenantB.body.id;

    const userA = await request(app.getHttpServer())
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        tenantId: tenantAId,
        email: `op-admin-a-${suffix}@aislamiento-test.com`,
        password: 'PasswordSeguro123',
        nombre: 'Admin Operacion A',
      });
    expect(userA.status).toBe(201);

    const userB = await request(app.getHttpServer())
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        tenantId: tenantBId,
        email: `op-admin-b-${suffix}@aislamiento-test.com`,
        password: 'PasswordSeguro123',
        nombre: 'Admin Operacion B',
      });
    expect(userB.status).toBe(201);

    tokenA = await login(`op-admin-a-${suffix}@aislamiento-test.com`, 'PasswordSeguro123');
    tokenB = await login(`op-admin-b-${suffix}@aislamiento-test.com`, 'PasswordSeguro123');

    const carriers = await request(app.getHttpServer())
      .get('/api/carriers')
      .set('Authorization', `Bearer ${tokenA}`);
    carrierId = carriers.body[0].id;

    const partnerA = await request(app.getHttpServer())
      .post('/api/partners')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ tipo: 'cliente', nombre: `Cliente Operacion A ${suffix}` });
    expect(partnerA.status).toBe(201);
    partnerAId = partnerA.body.id;

    const shipmentA = await request(app.getHttpServer())
      .post('/api/shipments')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        tipo: 'exportacion',
        modo: 'maritimo',
        remitenteNombre: 'Remitente Operacion A',
        destinatarioNombre: 'Destinatario Operacion A',
        origen: 'Guayaquil, EC',
        destino: 'Valparaíso, CL',
      });
    expect(shipmentA.status).toBe(201);
    shipmentAId = shipmentA.body.id;

    const quoteA = await request(app.getHttpServer())
      .post('/api/quotes')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ clienteId: partnerAId, tipo: 'exportacion', modo: 'maritimo', carrierId, origen: 'Guayaquil, EC', destino: 'Valparaíso, CL' });
    expect(quoteA.status).toBe(201);
    quoteAId = quoteA.body.id;

    const bookingA = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ clienteId: partnerAId, tipo: 'exportacion', modo: 'maritimo', carrierId, origen: 'Guayaquil, EC', destino: 'Valparaíso, CL' });
    expect(bookingA.status).toBe(201);
    bookingAId = bookingA.body.id;

    const containerA = await request(app.getHttpServer())
      .post('/api/containers')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ numeroContenedor: `CONT-A-${suffix}`, origen: 'Guayaquil, EC', destino: 'Valparaíso, CL' });
    expect(containerA.status).toBe(201);
    containerAId = containerA.body.id;

    const vehicleA = await request(app.getHttpServer())
      .post('/api/vehicles')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ placa: `OPA-${suffix}`, tipo: 'camion' });
    expect(vehicleA.status).toBe(201);
    vehicleAId = vehicleA.body.id;

    const driverA = await request(app.getHttpServer())
      .post('/api/drivers')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nombre: 'Conductor Operacion A', licencia: `LIC-A-${suffix}` });
    expect(driverA.status).toBe(201);
    driverAId = driverA.body.id;

    const assignmentA = await request(app.getHttpServer())
      .post('/api/vehicle-assignments')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ vehicleId: vehicleAId, driverId: driverAId });
    expect(assignmentA.status).toBe(201);
    assignmentAId = assignmentA.body.id;

    const warehouseA = await request(app.getHttpServer())
      .post('/api/warehouses')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nombre: `Bodega Operacion A ${suffix}` });
    expect(warehouseA.status).toBe(201);
    warehouseAId = warehouseA.body.id;

    const itemA = await request(app.getHttpServer())
      .post('/api/inventory-items')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ warehouseId: warehouseAId, descripcion: 'Ítem Operacion A', cantidad: 10 });
    expect(itemA.status).toBe(201);
    itemAId = itemA.body.id;

    const alertA = await request(app.getHttpServer())
      .post('/api/alerts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ tipo: 'cambio_estado', shipmentId: shipmentAId, condicion: {} });
    expect(alertA.status).toBe(201);
    alertAId = alertA.body.id;

    const notificationA = await request(app.getHttpServer())
      .post('/api/notifications')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ canal: 'email', tipo: 'envio_creado', asunto: 'Envío creado', mensaje: 'Tu envío fue creado' });
    expect(notificationA.status).toBe(201);
    notificationAId = notificationA.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('quotes', () => {
    it('el tenant B no ve la cotización de A y no puede modificarla', async () => {
      const list = await request(app.getHttpServer()).get('/api/quotes').set('Authorization', `Bearer ${tokenB}`);
      expect((list.body as Array<{ id: string }>).map((q) => q.id)).not.toContain(quoteAId);

      const patch = await request(app.getHttpServer())
        .patch(`/api/quotes/${quoteAId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ notas: 'secuestrada' });
      expect(patch.status).toBe(404);
    });
  });

  describe('bookings', () => {
    it('el tenant B no ve la reserva de A, no puede modificarla ni convertirla en envío', async () => {
      const list = await request(app.getHttpServer()).get('/api/bookings').set('Authorization', `Bearer ${tokenB}`);
      expect((list.body as Array<{ id: string }>).map((b) => b.id)).not.toContain(bookingAId);

      const patch = await request(app.getHttpServer())
        .patch(`/api/bookings/${bookingAId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ origen: 'secuestrada' });
      expect(patch.status).toBe(404);

      const convertir = await request(app.getHttpServer())
        .post(`/api/bookings/${bookingAId}/convertir-a-envio`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(convertir.status).toBe(404);
    });
  });

  describe('containers', () => {
    it('el tenant B no ve el contenedor de A y no puede modificarlo', async () => {
      const list = await request(app.getHttpServer()).get('/api/containers').set('Authorization', `Bearer ${tokenB}`);
      expect((list.body as Array<{ id: string }>).map((c) => c.id)).not.toContain(containerAId);

      const patch = await request(app.getHttpServer())
        .patch(`/api/containers/${containerAId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ destino: 'secuestrado' });
      expect(patch.status).toBe(404);
    });

    it('el tenant B no puede asignar el envío de A a su propio contenedor', async () => {
      const containerB = await request(app.getHttpServer())
        .post('/api/containers')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ numeroContenedor: `CONT-B-${suffix}`, origen: 'Lima, PE', destino: 'Quito, EC' });
      expect(containerB.status).toBe(201);

      const asignar = await request(app.getHttpServer())
        .post(`/api/containers/${containerB.body.id}/envios/${shipmentAId}`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(asignar.status).toBe(404);
    });
  });

  describe('fleet', () => {
    it('el tenant B no ve el vehículo de A, no puede modificarlo ni agendarle mantenimiento', async () => {
      const list = await request(app.getHttpServer()).get('/api/vehicles').set('Authorization', `Bearer ${tokenB}`);
      expect((list.body as Array<{ id: string }>).map((v) => v.id)).not.toContain(vehicleAId);

      const getOne = await request(app.getHttpServer())
        .get(`/api/vehicles/${vehicleAId}`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(getOne.status).toBe(404);

      const patch = await request(app.getHttpServer())
        .patch(`/api/vehicles/${vehicleAId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ tipo: 'secuestrado' });
      expect(patch.status).toBe(404);

      const mantenimiento = await request(app.getHttpServer())
        .post(`/api/vehicles/${vehicleAId}/maintenance`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ tipo: 'preventivo' });
      expect(mantenimiento.status).toBe(404);
    });

    it('el tenant B no puede crear una asignación usando el vehículo de A, ni finalizar la asignación de A', async () => {
      const driverB = await request(app.getHttpServer())
        .post('/api/drivers')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ nombre: 'Conductor Operacion B', licencia: `LIC-B-${suffix}` });
      expect(driverB.status).toBe(201);

      const asignacion = await request(app.getHttpServer())
        .post('/api/vehicle-assignments')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ vehicleId: vehicleAId, driverId: driverB.body.id });
      expect(asignacion.status).toBe(404);

      const finalizar = await request(app.getHttpServer())
        .patch(`/api/vehicle-assignments/${assignmentAId}/finalizar`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(finalizar.status).toBe(404);
    });
  });

  describe('warehouses / inventario', () => {
    it('el tenant B no ve la bodega de A y no puede agregarle ubicaciones ni ítems', async () => {
      const list = await request(app.getHttpServer()).get('/api/warehouses').set('Authorization', `Bearer ${tokenB}`);
      expect((list.body as Array<{ id: string }>).map((w) => w.id)).not.toContain(warehouseAId);

      const getOne = await request(app.getHttpServer())
        .get(`/api/warehouses/${warehouseAId}`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(getOne.status).toBe(404);

      const location = await request(app.getHttpServer())
        .post(`/api/warehouses/${warehouseAId}/locations`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ codigo: 'X-01' });
      expect(location.status).toBe(404);

      const item = await request(app.getHttpServer())
        .post('/api/inventory-items')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ warehouseId: warehouseAId, descripcion: 'Intento tenant B', cantidad: 1 });
      expect(item.status).toBe(404);
    });

    it('el tenant B no ve el ítem de A y no puede registrar movimientos sobre él', async () => {
      const list = await request(app.getHttpServer()).get('/api/inventory-items').set('Authorization', `Bearer ${tokenB}`);
      expect((list.body as Array<{ id: string }>).map((i) => i.id)).not.toContain(itemAId);

      const movimiento = await request(app.getHttpServer())
        .post(`/api/inventory-items/${itemAId}/movimientos`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ tipo: 'entrada', cantidad: 5 });
      expect(movimiento.status).toBe(404);

      // El stock de A debe quedar intacto tras el intento de B.
      const verificacion = await request(app.getHttpServer())
        .get('/api/inventory-items')
        .set('Authorization', `Bearer ${tokenA}`);
      const itemVerificado = (verificacion.body as Array<{ id: string; cantidad: number }>).find(
        (i) => i.id === itemAId,
      );
      expect(itemVerificado?.cantidad).toBe(10);
    });
  });

  describe('alerts', () => {
    it('el tenant B no ve la alerta de A y no puede modificarla', async () => {
      const list = await request(app.getHttpServer()).get('/api/alerts').set('Authorization', `Bearer ${tokenB}`);
      expect((list.body as Array<{ id: string }>).map((a) => a.id)).not.toContain(alertAId);

      const patch = await request(app.getHttpServer())
        .patch(`/api/alerts/${alertAId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ activo: false });
      expect(patch.status).toBe(404);
    });
  });

  describe('notifications', () => {
    it('el tenant B no ve la notificación de A y no puede marcarla como enviada', async () => {
      const list = await request(app.getHttpServer()).get('/api/notifications').set('Authorization', `Bearer ${tokenB}`);
      expect((list.body as Array<{ id: string }>).map((n) => n.id)).not.toContain(notificationAId);

      const marcar = await request(app.getHttpServer())
        .patch(`/api/notifications/${notificationAId}/marcar-enviada`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(marcar.status).toBe(404);
    });
  });

  describe('tracking-events', () => {
    it('el tenant B no puede registrar un evento de tracking sobre el envío de A', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/tracking-events')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ shipmentId: shipmentAId, estado: 'en_transito' });
      expect(res.status).toBe(404);
    });

    it('el tenant B no ve eventos de tracking del envío de A al consultarlo directamente', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/tracking-events/shipment/${shipmentAId}`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });
});
