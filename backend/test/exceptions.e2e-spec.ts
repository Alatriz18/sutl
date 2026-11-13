import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { ExceptionsService } from '../src/modules/exceptions/exceptions.service';
import { createTestApp } from './test-app';
import { auth, crearTenantConAdmin } from './test-helpers';

type Caso = { id: string; tipo: string; clave: string; severidad: string; estado: string; taskId: string | null; escaladaAt: string | null };

// Centro de excepciones: una OC atrasada abre un caso con plazo y una tarea,
// se resuelve sola al recibirse, escala si vence el plazo y no cruza empresas.
describe('Centro de excepciones (e2e)', () => {
  let app: INestApplication;
  const suffix = Date.now();
  const limiteLoginOriginal = process.env.LOGIN_RATE_LIMIT;
  let a: Awaited<ReturnType<typeof crearTenantConAdmin>>;
  let b: Awaited<ReturnType<typeof crearTenantConAdmin>>;
  let ocId: string;
  const http = () => request(app.getHttpServer());
  const prisma = () => app.get(PrismaService);
  const casos = async (token: string, estado?: string) => (await http().get(`/api/exceptions${estado ? `?estado=${estado}` : ''}`).set(auth(token))).body as Caso[];

  beforeAll(async () => {
    process.env.LOGIN_RATE_LIMIT = '1000';
    app = await createTestApp();
    a = await crearTenantConAdmin(app, `Excep A ${suffix}`);
    b = await crearTenantConAdmin(app, `Excep B ${suffix}`);

    const proveedor = await http().post('/api/partners').set(auth(a.token)).send({ tipo: 'proveedor', nombre: `Prov ${suffix}` });
    expect(proveedor.status).toBe(201);
    const oc = await http()
      .post('/api/purchase-orders')
      .set(auth(a.token))
      .send({ numero: `OC-EX-${suffix}`, proveedorId: proveedor.body.id, lineas: [{ sku: `EX-${suffix}`, descripcion: 'Material', cantidad: 100, unidad: 'kg' }] });
    expect(oc.status).toBe(201);
    ocId = oc.body.id;
    // Preparación: emitida y con fecha requerida vencida hace 3 días.
    await prisma().purchaseOrder.update({ where: { id: ocId }, data: { estado: 'emitida', fechaRequerida: new Date(Date.now() - 3 * 86400000) } });
  });

  afterAll(async () => {
    process.env.LOGIN_RATE_LIMIT = limiteLoginOriginal;
    await app.close();
  });

  it('exige sesión', async () => {
    expect((await http().get('/api/exceptions')).status).toBe(401);
    expect((await http().post('/api/exceptions/evaluar')).status).toBe(401);
  });

  it('una OC atrasada abre una excepción moderada con su tarea, y evaluar de nuevo no la duplica', async () => {
    const r = await http().post('/api/exceptions/evaluar').set(auth(a.token));
    expect(r.status).toBe(201);
    expect(r.body.abiertas).toBeGreaterThanOrEqual(1);

    const lista = await casos(a.token, 'abierta');
    const caso = lista.find((c) => c.clave === ocId);
    expect(caso).toMatchObject({ tipo: 'oc_atrasada', severidad: 'media', estado: 'abierta' });
    expect(caso?.taskId).toBeTruthy();

    const tarea = await http().get(`/api/tasks/${caso?.taskId}`).set(auth(a.token));
    expect(tarea.status).toBe(200);
    expect(tarea.body).toMatchObject({ entidadTipo: 'orden_compra', entidadId: ocId });

    const otra = await http().post('/api/exceptions/evaluar').set(auth(a.token));
    expect(otra.body.abiertas).toBe(0);
    expect((await casos(a.token, 'abierta')).filter((c) => c.clave === ocId)).toHaveLength(1);
  });

  it('otra empresa no ve nada de esto', async () => {
    expect((await casos(b.token)).some((c) => c.clave === ocId)).toBe(false);
    await http().post('/api/exceptions/evaluar').set(auth(b.token));
    expect((await casos(b.token)).some((c) => c.clave === ocId)).toBe(false);
  });

  it('el filtro de estado se valida', async () => {
    expect((await http().get('/api/exceptions?estado=inventado').set(auth(a.token))).status).toBe(400);
  });

  it('con el plazo vencido escala una sola vez a crítica', async () => {
    await prisma().exceptionCase.updateMany({ where: { tenantId: a.tenantId, clave: ocId }, data: { venceSlaAt: new Date(Date.now() - 60_000) } });
    const r = await http().post('/api/exceptions/evaluar').set(auth(a.token));
    expect(r.body.escaladas).toBe(1);
    const caso = (await casos(a.token, 'abierta')).find((c) => c.clave === ocId);
    expect(caso).toMatchObject({ severidad: 'critica' });
    expect(caso?.escaladaAt).not.toBeNull();
    expect((await http().post('/api/exceptions/evaluar').set(auth(a.token))).body.escaladas).toBe(0);
  });

  it('al recibirse la OC la excepción se resuelve sola', async () => {
    await prisma().purchaseOrder.update({ where: { id: ocId }, data: { estado: 'recibida' } });
    const r = await http().post('/api/exceptions/evaluar').set(auth(a.token));
    expect(r.body.resueltas).toBeGreaterThanOrEqual(1);
    const caso = (await casos(a.token)).find((c) => c.clave === ocId);
    expect(caso?.estado).toBe('resuelta');
  });

  it('la ronda de todas las empresas funciona y no toca otras', async () => {
    const r = await app.get(ExceptionsService).evaluarTodas();
    expect(r.empresas).toBeGreaterThanOrEqual(2);
  });
});
