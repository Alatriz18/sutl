import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './test-app';
import { auth, crearTenantConAdmin, ENVIO_BASE, loginAs, PASSWORD } from './test-helpers';

const PDF = Buffer.from('%PDF-1.4 fuga');
const PROHIBIDOS = ['password', 'mfaSecret', 'refreshTokenHash', 'mfaLastStep', 'mfaFailures', 'mfaLockedUntil', 'mfaEnabledAt'];

// Regresión de seguridad: los documentos NUNCA devuelven datos secretos de quien los subió.
describe('Documentos no filtran datos de usuarios (e2e)', () => {
  let app: INestApplication;
  const suffix = Date.now();
  const limiteLoginOriginal = process.env.LOGIN_RATE_LIMIT;
  let a: Awaited<ReturnType<typeof crearTenantConAdmin>>;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    process.env.LOGIN_RATE_LIMIT = '1000';
    app = await createTestApp();
    a = await crearTenantConAdmin(app, `DocFuga ${suffix}`);
  });

  afterAll(async () => {
    process.env.LOGIN_RATE_LIMIT = limiteLoginOriginal;
    await app.close();
  });

  const claves = (valor: unknown): string[] => (valor && typeof valor === 'object' ? Object.entries(valor as object).flatMap(([k, v]) => [k, ...claves(v)]) : []);

  it('ni al subir un documento ni al listarlos aparecen contraseñas, secretos o tokens de quien lo subió', async () => {
    const envio = await http().post('/api/shipments').set(auth(a.token)).send(ENVIO_BASE);
    const subida = await http().post('/api/documents').set(auth(a.token)).field('shipmentId', envio.body.id).field('tipo', 'factura').attach('file', PDF, 'f.pdf');
    expect(subida.status).toBe(201);
    expect(claves(subida.body).filter((k) => PROHIBIDOS.includes(k))).toEqual([]);

    // Un operador (otro usuario) lista los documentos de la empresa y ve quién subió, sin secretos.
    const email = `op-fuga-${suffix}@e2e-test.com`;
    expect((await http().post('/api/users').set(auth(a.token)).send({ email, password: PASSWORD, nombre: 'Op', rol: 'operador' })).status).toBe(201);
    const operador = await loginAs(app, email);
    const lista = await http().get('/api/documents').set(auth(operador));
    expect(lista.status).toBe(200);
    expect(lista.body.length).toBeGreaterThan(0);
    expect(claves(lista.body).filter((k) => PROHIBIDOS.includes(k))).toEqual([]);
    expect(lista.body[0].subidoPor).toEqual({ id: a.userId, nombre: expect.any(String), email: a.email });
    expect(JSON.stringify(lista.body)).not.toContain('$2b$'); // ningún hash de bcrypt
  });

  it('el listado interno no lo puede usar un cliente final ni un proveedor', async () => {
    const emailC = `cli-fuga-${suffix}@e2e-test.com`;
    expect((await http().post('/api/users').set(auth(a.token)).send({ email: emailC, password: PASSWORD, nombre: 'Cli', rol: 'cliente_final' })).status).toBe(201);
    const tokenC = await loginAs(app, emailC);
    expect((await http().get('/api/documents').set(auth(tokenC))).status).toBe(403);
    const p = await http().post('/api/partners').set(auth(a.token)).send({ tipo: 'proveedor', nombre: `P ${suffix}` });
    const emailP = `prov-fuga-${suffix}@e2e-test.com`;
    expect((await http().post('/api/users').set(auth(a.token)).send({ email: emailP, password: PASSWORD, nombre: 'Prov', rol: 'proveedor', partnerId: p.body.id })).status).toBe(201);
    const tokenP = await loginAs(app, emailP);
    expect((await http().get('/api/documents').set(auth(tokenP))).status).toBe(403);
  });
});
