import { INestApplication } from '@nestjs/common';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import * as request from 'supertest';
import { createTestApp } from './test-app';
import { auth, crearTenantConAdmin, ENVIO_BASE, PASSWORD } from './test-helpers';

const PDF = Buffer.from('%PDF-1.4 contenido real');
const EXE = Buffer.from('MZ\x90\x00 esto es un ejecutable renombrado');

// Subidas de archivos: el contenido debe corresponder a la extensión y una subida rechazada no deja archivos huérfanos.
describe('Seguridad de las subidas de archivos (e2e)', () => {
  let app: INestApplication;
  const suffix = Date.now();
  const limiteLoginOriginal = process.env.LOGIN_RATE_LIMIT;
  let a: Awaited<ReturnType<typeof crearTenantConAdmin>>;
  let b: Awaited<ReturnType<typeof crearTenantConAdmin>>;
  let envioId: string;
  let tareaId: string;
  const http = () => request(app.getHttpServer());
  const archivosDe = (tenantId: string) => {
    const dir = join(process.cwd(), 'uploads', tenantId);
    return existsSync(dir) ? readdirSync(dir).length : 0;
  };

  beforeAll(async () => {
    process.env.LOGIN_RATE_LIMIT = '1000';
    app = await createTestApp();
    a = await crearTenantConAdmin(app, `Subidas A ${suffix}`);
    b = await crearTenantConAdmin(app, `Subidas B ${suffix}`);
    envioId = (await http().post('/api/shipments').set(auth(a.token)).send(ENVIO_BASE)).body.id;
    tareaId = (await http().post('/api/tasks').set(auth(a.token)).send({ titulo: 'Con evidencia' })).body.id;
  });

  afterAll(async () => {
    process.env.LOGIN_RATE_LIMIT = limiteLoginOriginal;
    await app.close();
  });

  it('un ejecutable renombrado como .pdf se rechaza en documentos, tareas y entrega, sin dejar archivo', async () => {
    const antes = archivosDe(a.tenantId);
    expect((await http().post('/api/documents').set(auth(a.token)).field('shipmentId', envioId).field('tipo', 'factura').attach('file', EXE, 'factura.pdf')).status).toBe(400);
    expect((await http().post(`/api/tasks/${tareaId}/adjuntos`).set(auth(a.token)).attach('file', EXE, 'foto.png')).status).toBe(400);
    expect((await http().post(`/api/shipments/${envioId}/pod`).set(auth(a.token)).field('receptorNombre', 'Luis').attach('evidencia', EXE, 'prueba.jpg')).status).toBe(400);
    expect(archivosDe(a.tenantId)).toBe(antes);
  });

  it('el contenido correcto sigue aceptándose', async () => {
    expect((await http().post('/api/documents').set(auth(a.token)).field('shipmentId', envioId).field('tipo', 'factura').attach('file', PDF, 'factura.pdf')).status).toBe(201);
    expect((await http().post(`/api/tasks/${tareaId}/adjuntos`).set(auth(a.token)).attach('file', PDF, 'acta.pdf')).status).toBe(201);
  });

  it('una subida rechazada por permisos o por empresa ajena no deja archivos huérfanos', async () => {
    const op = await http().post('/api/users').set(auth(a.token)).send({ email: `sub-op-${suffix}@e2e-test.com`, password: PASSWORD, nombre: 'Operador', rol: 'operador' });
    expect(op.status).toBe(201);
    const tokenOp = (await http().post('/api/auth/login').send({ email: `sub-op-${suffix}@e2e-test.com`, password: PASSWORD })).body.accessToken as string;
    const antesA = archivosDe(a.tenantId);
    const antesB = archivosDe(b.tenantId);
    expect((await http().post(`/api/tasks/${tareaId}/adjuntos`).set(auth(tokenOp)).attach('file', PDF, 'x.pdf')).status).toBe(403); // ni la creó ni es suya
    expect((await http().post(`/api/tasks/${tareaId}/adjuntos`).set(auth(b.token)).attach('file', PDF, 'x.pdf')).status).toBe(404); // otra empresa
    expect((await http().post('/api/documents').set(auth(b.token)).field('shipmentId', envioId).field('tipo', 'factura').attach('file', PDF, 'y.pdf')).status).toBe(404); // envío ajeno
    expect(archivosDe(a.tenantId)).toBe(antesA);
    expect(archivosDe(b.tenantId)).toBe(antesB);
  });
});
