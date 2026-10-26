import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './test-app';

// Misma lógica que tenant-isolation.e2e-spec.ts pero sobre los módulos que
// tocan dinero: partners, contratos, tarifas y facturas. Estos son los que
// más daño causarían si el aislamiento fallara (ver docs/ESTADO_PROYECTO.md).
const SUPER_ADMIN = { email: 'admin@sutl.dev', password: 'SutlAdmin2026!' };

describe('Aislamiento multi-tenant — módulos financieros (e2e)', () => {
  let app: INestApplication;
  const suffix = Date.now();

  let tokenA: string;
  let tokenB: string;
  let carrierId: string;

  let partnerAId: string;
  let invoiceAId: string;
  let contractAId: string;
  let rateAId: string;

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
      .send({ nombre: `Tenant Financiero A ${suffix}`, plan: 'trial' });
    expect(tenantA.status).toBe(201);
    const tenantAId = tenantA.body.id;

    const tenantB = await request(app.getHttpServer())
      .post('/api/tenants')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ nombre: `Tenant Financiero B ${suffix}`, plan: 'trial' });
    expect(tenantB.status).toBe(201);
    const tenantBId = tenantB.body.id;

    const userA = await request(app.getHttpServer())
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        tenantId: tenantAId,
        email: `fin-admin-a-${suffix}@aislamiento-test.com`,
        password: 'PasswordSeguro123',
        nombre: 'Admin Financiero A',
      });
    expect(userA.status).toBe(201);

    const userB = await request(app.getHttpServer())
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        tenantId: tenantBId,
        email: `fin-admin-b-${suffix}@aislamiento-test.com`,
        password: 'PasswordSeguro123',
        nombre: 'Admin Financiero B',
      });
    expect(userB.status).toBe(201);

    tokenA = await login(`fin-admin-a-${suffix}@aislamiento-test.com`, 'PasswordSeguro123');
    tokenB = await login(`fin-admin-b-${suffix}@aislamiento-test.com`, 'PasswordSeguro123');

    // Catálogo global de carriers: compartido por todos los tenants, solo lectura.
    const carriers = await request(app.getHttpServer())
      .get('/api/carriers')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(carriers.status).toBe(200);
    expect(carriers.body.length).toBeGreaterThan(0);
    carrierId = carriers.body[0].id;

    const partnerA = await request(app.getHttpServer())
      .post('/api/partners')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ tipo: 'cliente', nombre: `Cliente Financiero A ${suffix}` });
    expect(partnerA.status).toBe(201);
    partnerAId = partnerA.body.id;

    const invoiceA = await request(app.getHttpServer())
      .post('/api/invoices')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ tipo: 'cxc', partnerId: partnerAId, montoTotal: 1500 });
    expect(invoiceA.status).toBe(201);
    invoiceAId = invoiceA.body.id;

    const contractA = await request(app.getHttpServer())
      .post('/api/contracts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        carrierId,
        nombre: `Contrato Financiero A ${suffix}`,
        vigenteDesde: new Date().toISOString(),
      });
    expect(contractA.status).toBe(201);
    contractAId = contractA.body.id;

    const rateA = await request(app.getHttpServer())
      .post('/api/rates')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        carrierId,
        origen: 'Guayaquil, EC',
        destino: 'Shanghai, CN',
        modo: 'maritimo',
        tipo: 'importacion',
        unidad: 'contenedor_40',
        precioBase: 3200,
      });
    expect(rateA.status).toBe(201);
    rateAId = rateA.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('partners', () => {
    it('el tenant B no ve al partner del tenant A en su listado', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/partners')
        .set('Authorization', `Bearer ${tokenB}`);
      expect(res.status).toBe(200);
      expect((res.body as Array<{ id: string }>).map((p) => p.id)).not.toContain(partnerAId);
    });

    it('el tenant B recibe 404 al pedir el partner del tenant A por id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/partners/${partnerAId}`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(res.status).toBe(404);
    });
  });

  describe('invoices', () => {
    it('el tenant B no ve la factura del tenant A en su listado', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/invoices')
        .set('Authorization', `Bearer ${tokenB}`);
      expect(res.status).toBe(200);
      expect((res.body as Array<{ id: string }>).map((i) => i.id)).not.toContain(invoiceAId);
    });

    it('el tenant B recibe 404 al pedir la factura del tenant A por id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/invoices/${invoiceAId}`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(res.status).toBe(404);
    });

    it('el tenant B no puede registrar un pago contra la factura del tenant A', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/invoices/${invoiceAId}/pagos`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ monto: 1500, metodo: 'transferencia' });
      expect(res.status).toBe(404);

      // La factura de A debe seguir pendiente, no pagada por el intento de B.
      const verificacion = await request(app.getHttpServer())
        .get(`/api/invoices/${invoiceAId}`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(verificacion.status).toBe(200);
      expect(verificacion.body.estado).not.toBe('pagada');
    });
  });

  describe('contracts', () => {
    it('el tenant B no ve el contrato del tenant A en su listado', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/contracts')
        .set('Authorization', `Bearer ${tokenB}`);
      expect(res.status).toBe(200);
      expect((res.body as Array<{ id: string }>).map((c) => c.id)).not.toContain(contractAId);
    });

    it('el tenant B recibe 404 al pedir el contrato del tenant A por id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/contracts/${contractAId}`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(res.status).toBe(404);
    });

    it('el tenant B no puede modificar ni desactivar el contrato del tenant A', async () => {
      const patch = await request(app.getHttpServer())
        .patch(`/api/contracts/${contractAId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ nombre: 'Secuestrado por tenant B' });
      expect(patch.status).toBe(404);

      const del = await request(app.getHttpServer())
        .delete(`/api/contracts/${contractAId}`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(del.status).toBe(404);

      const verificacion = await request(app.getHttpServer())
        .get(`/api/contracts/${contractAId}`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(verificacion.status).toBe(200);
      expect(verificacion.body.activo).toBe(true);
    });
  });

  describe('rates', () => {
    it('el tenant B no ve la tarifa negociada del tenant A en su listado (solo ve las globales)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/rates')
        .set('Authorization', `Bearer ${tokenB}`);
      expect(res.status).toBe(200);
      expect((res.body as Array<{ id: string }>).map((r) => r.id)).not.toContain(rateAId);
    });

    it('el tenant B recibe 404 al pedir la tarifa negociada del tenant A por id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/rates/${rateAId}`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(res.status).toBe(404);
    });

    it('el tenant B no puede modificar ni desactivar la tarifa negociada del tenant A', async () => {
      const patch = await request(app.getHttpServer())
        .patch(`/api/rates/${rateAId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ precioBase: 1 });
      expect(patch.status).toBe(404);

      const del = await request(app.getHttpServer())
        .delete(`/api/rates/${rateAId}`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(del.status).toBe(404);

      const verificacion = await request(app.getHttpServer())
        .get(`/api/rates/${rateAId}`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(verificacion.status).toBe(200);
      expect(verificacion.body.precioBase).toBe(3200);
      expect(verificacion.body.activo).toBe(true);
    });
  });
});
