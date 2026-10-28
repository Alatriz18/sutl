import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './test-app';

// Escalada de privilegios: un admin_tenant gestiona los usuarios de su
// empresa, pero nunca puede crear ni ascender a alguien a super_admin (ese
// rol ve y administra todos los tenants).
const DEMO_ADMIN = { email: 'admin@demo-transportes.com', password: 'Demo2026!' };

describe('Usuarios — asignación de roles (e2e)', () => {
  let app: INestApplication;
  let token: string;
  const suffix = Date.now();

  beforeAll(async () => {
    app = await createTestApp();
    const login = await request(app.getHttpServer()).post('/api/auth/login').send(DEMO_ADMIN);
    expect(login.status).toBe(200);
    token = login.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('admin_tenant no puede crear un usuario super_admin (403)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: `escalada-${suffix}@roles-test.com`,
        password: 'PasswordSeguro123',
        nombre: 'Intento de escalada',
        rol: 'super_admin',
      });
    expect(res.status).toBe(403);
  });

  it('admin_tenant no puede ascender un usuario existente a super_admin (403)', async () => {
    const creado = await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: `operador-${suffix}@roles-test.com`,
        password: 'PasswordSeguro123',
        nombre: 'Operador normal',
        rol: 'operador',
      });
    expect(creado.status).toBe(201);

    const ascenso = await request(app.getHttpServer())
      .patch(`/api/users/${creado.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rol: 'super_admin' });
    expect(ascenso.status).toBe(403);

    const verificado = await request(app.getHttpServer())
      .get(`/api/users/${creado.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(verificado.body.rol).toBe('operador');
  });

  it('admin_tenant sí puede asignar roles de su empresa (operador → admin_tenant)', async () => {
    const creado = await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: `promovible-${suffix}@roles-test.com`,
        password: 'PasswordSeguro123',
        nombre: 'Operador a promover',
      });
    expect(creado.status).toBe(201);

    const res = await request(app.getHttpServer())
      .patch(`/api/users/${creado.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rol: 'admin_tenant' });
    expect(res.status).toBe(200);
    expect(res.body.rol).toBe('admin_tenant');
  });
});
