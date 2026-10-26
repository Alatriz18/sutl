import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './test-app';

// Credenciales del seed (backend/prisma/seed.ts) — deben existir en la base
// de Docker Compose local antes de correr estas pruebas (`npm run prisma:seed`).
const SUPER_ADMIN = { email: 'admin@sutl.dev', password: 'SutlAdmin2026!' };
const DEMO_ADMIN = { email: 'admin@demo-transportes.com', password: 'Demo2026!' };

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/login — credenciales válidas devuelve accessToken y setea cookie httpOnly', async () => {
    const res = await request(app.getHttpServer()).post('/api/auth/login').send(DEMO_ADMIN);

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    const cookie = res.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toContain('refreshToken=');
    expect(cookie.toLowerCase()).toContain('httponly');
  });

  it('POST /auth/login — contraseña incorrecta devuelve 401 sin filtrar si el email existe', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: DEMO_ADMIN.email, password: 'contraseña-incorrecta' });

    expect(res.status).toBe(401);
  });

  it('POST /auth/login — usuario inexistente también devuelve 401 (mismo mensaje, no enumeración)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'no-existe@test.com', password: 'lo-que-sea' });

    expect(res.status).toBe(401);
  });

  it('POST /auth/login — body inválido (sin password) es rechazado por el ValidationPipe', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: DEMO_ADMIN.email });

    expect(res.status).toBe(400);
  });

  it('POST /auth/register — sin token devuelve 401 (no debe ser auto-registro público)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        tenantId: '00000000-0000-0000-0000-000000000000',
        email: 'intruso@evil.com',
        password: 'hackeame123',
        nombre: 'Intruso',
      });

    expect(res.status).toBe(401);
  });

  it('POST /auth/register — autenticado pero sin rol super_admin devuelve 403', async () => {
    const login = await request(app.getHttpServer()).post('/api/auth/login').send(DEMO_ADMIN);
    const token = login.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tenantId: '00000000-0000-0000-0000-000000000000',
        email: 'otro-intento@evil.com',
        password: 'hackeame123',
        nombre: 'Otro intento',
      });

    expect(res.status).toBe(403);
  });

  it('POST /auth/register — con tenantId inexistente devuelve 401 aunque el llamante sea super_admin', async () => {
    const login = await request(app.getHttpServer()).post('/api/auth/login').send(SUPER_ADMIN);
    const token = login.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tenantId: '00000000-0000-0000-0000-000000000000',
        email: 'nuevo@tenant-inexistente.com',
        password: 'contraseñaSegura123',
        nombre: 'Nuevo usuario',
      });

    expect(res.status).toBe(401);
  });

  it('GET /api/tenants sin token devuelve 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/tenants');
    expect(res.status).toBe(401);
  });

  it('POST /auth/login — más de 5 intentos por minuto responde 429 (anti fuerza bruta)', async () => {
    const attempts = Array.from({ length: 6 }, () =>
      request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'fuerza-bruta@test.com', password: 'x' }),
    );
    const results = await Promise.all(attempts);
    const blocked = results.filter((r) => r.status === 429);
    expect(blocked.length).toBeGreaterThan(0);
  });
});
