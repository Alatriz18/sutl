import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './test-app';

// La prueba más importante del sistema: un tenant NUNCA debe poder leer,
// modificar ni listar los datos de otro tenant. Esto ejercita de punta a
// punta el flujo real: super_admin crea 2 tenants → aprovisiona un usuario
// en cada uno → cada quien crea sus propios datos → se verifica el cruce.
const SUPER_ADMIN = { email: 'admin@sutl.dev', password: 'SutlAdmin2026!' };

describe('Aislamiento multi-tenant (e2e)', () => {
  let app: INestApplication;
  const suffix = Date.now();

  let tenantAId: string;
  let tenantBId: string;
  let tokenA: string;
  let tokenB: string;
  let userAId: string;
  let shipmentAId: string;

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
      .send({ nombre: `Tenant Aislamiento A ${suffix}`, plan: 'trial' });
    expect(tenantA.status).toBe(201);
    tenantAId = tenantA.body.id;

    const tenantB = await request(app.getHttpServer())
      .post('/api/tenants')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ nombre: `Tenant Aislamiento B ${suffix}`, plan: 'trial' });
    expect(tenantB.status).toBe(201);
    tenantBId = tenantB.body.id;

    const userA = await request(app.getHttpServer())
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        tenantId: tenantAId,
        email: `admin-a-${suffix}@aislamiento-test.com`,
        password: 'PasswordSeguro123',
        nombre: 'Admin Tenant A',
      });
    expect(userA.status).toBe(201);
    userAId = userA.body.id;

    const userB = await request(app.getHttpServer())
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        tenantId: tenantBId,
        email: `admin-b-${suffix}@aislamiento-test.com`,
        password: 'PasswordSeguro123',
        nombre: 'Admin Tenant B',
      });
    expect(userB.status).toBe(201);

    tokenA = await login(`admin-a-${suffix}@aislamiento-test.com`, 'PasswordSeguro123');
    tokenB = await login(`admin-b-${suffix}@aislamiento-test.com`, 'PasswordSeguro123');

    const shipment = await request(app.getHttpServer())
      .post('/api/shipments')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        tipo: 'exportacion',
        modo: 'maritimo',
        remitenteNombre: 'Remitente A',
        destinatarioNombre: 'Destinatario A',
        origen: 'Guayaquil, EC',
        destino: 'Callao, PE',
      });
    expect(shipment.status).toBe(201);
    shipmentAId = shipment.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('el tenant B no ve el envío del tenant A en su listado', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/shipments')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    const ids = (res.body as Array<{ id: string }>).map((s) => s.id);
    expect(ids).not.toContain(shipmentAId);
  });

  it('el tenant B recibe 404 al pedir el envío del tenant A por id (no 403: no confirma que exista)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/shipments/${shipmentAId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
  });

  it('el tenant B no puede modificar el envío del tenant A', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/shipments/${shipmentAId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ destino: 'Secuestrado por tenant B' });

    expect(res.status).toBe(404);

    // Confirma que el dato de A quedó intacto, no solo que B recibió 404.
    const verificacion = await request(app.getHttpServer())
      .get(`/api/shipments/${shipmentAId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(verificacion.status).toBe(200);
    expect(verificacion.body.destino).toBe('Callao, PE');
  });

  it('el tenant B no puede leer el usuario del tenant A', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/users/${userAId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
  });

  it('el tenant B no ve al usuario del tenant A en su listado de usuarios', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    const ids = (res.body as Array<{ id: string }>).map((u) => u.id);
    expect(ids).not.toContain(userAId);
  });

  it('el tenant A sí ve y puede modificar su propio envío', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/shipments/${shipmentAId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ destino: 'Lima, PE' });

    expect(res.status).toBe(200);
    expect(res.body.destino).toBe('Lima, PE');
  });
});
