import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './test-app';
import { auth, crearTenantConAdmin, PASSWORD } from './test-helpers';

type Caso = { id: string; tipo: string; clave: string; taskId: string | null };

// Responsable por tipo de excepción: la tarea que abre cada excepción nace asignada a quien la empresa definió.
describe('Responsable de excepciones (e2e)', () => {
  let app: INestApplication;
  const suffix = Date.now();
  const limiteLoginOriginal = process.env.LOGIN_RATE_LIMIT;
  let a: Awaited<ReturnType<typeof crearTenantConAdmin>>;
  let b: Awaited<ReturnType<typeof crearTenantConAdmin>>;
  let operadorId: string;
  let proveedorUserId: string;
  const http = () => request(app.getHttpServer());
  const prisma = () => app.get(PrismaService);
  const fijar = (token: string, excepciones: Record<string, unknown>) => http().patch('/api/tenant-config').set(auth(token)).send({ configuracion: { excepciones } });
  const casos = async (token: string) => (await http().get('/api/exceptions').set(auth(token))).body as Caso[];

  async function ocAtrasada(numero: string) {
    const prov = await http().post('/api/partners').set(auth(a.token)).send({ tipo: 'proveedor', nombre: `Prov ${numero}` });
    const oc = await http().post('/api/purchase-orders').set(auth(a.token)).send({ numero, proveedorId: prov.body.id, lineas: [{ sku: `S-${numero}`, descripcion: 'Material', cantidad: 10, unidad: 'kg' }] });
    expect(oc.status).toBe(201);
    await prisma().purchaseOrder.update({ where: { id: oc.body.id }, data: { estado: 'emitida', fechaRequerida: new Date(Date.now() - 3 * 86400000) } });
    return { id: oc.body.id as string, partnerId: prov.body.id as string };
  }

  beforeAll(async () => {
    process.env.LOGIN_RATE_LIMIT = '1000';
    app = await createTestApp();
    a = await crearTenantConAdmin(app, `Resp A ${suffix}`);
    b = await crearTenantConAdmin(app, `Resp B ${suffix}`);
    const op = await http().post('/api/users').set(auth(a.token)).send({ email: `resp-op-${suffix}@e2e-test.com`, password: PASSWORD, nombre: 'Operador Responsable', rol: 'operador' });
    expect(op.status).toBe(201);
    operadorId = op.body.id;
    const prov = await http().post('/api/partners').set(auth(a.token)).send({ tipo: 'proveedor', nombre: `PX ${suffix}` });
    const pu = await http().post('/api/users').set(auth(a.token)).send({ email: `resp-prov-${suffix}@e2e-test.com`, password: PASSWORD, nombre: 'Prov externo', rol: 'proveedor', partnerId: prov.body.id });
    expect(pu.status).toBe(201);
    proveedorUserId = pu.body.id;
  });

  afterAll(async () => {
    process.env.LOGIN_RATE_LIMIT = limiteLoginOriginal;
    await app.close();
  });

  it('por defecto la tarea nace sin responsable (como antes)', async () => {
    await ocAtrasada(`OC-R0-${suffix}`);
    await http().post('/api/exceptions/evaluar').set(auth(a.token));
    const caso = (await casos(a.token)).find((c) => c.clave && c.tipo === 'oc_atrasada')!;
    const tarea = await prisma().task.findUniqueOrThrow({ where: { id: caso.taskId! } });
    expect(tarea.asignadoAId).toBeNull();
  });

  it('con responsable definido, la tarea de la siguiente excepción nace asignada a esa persona', async () => {
    expect((await fijar(a.token, { responsableOcAtrasadaId: operadorId })).status).toBe(200);
    const { id } = await ocAtrasada(`OC-R1-${suffix}`);
    await http().post('/api/exceptions/evaluar').set(auth(a.token));
    const caso = (await casos(a.token)).find((c) => c.clave === id)!;
    const tarea = await prisma().task.findUniqueOrThrow({ where: { id: caso.taskId! } });
    expect(tarea.asignadoAId).toBe(operadorId);
    // La tarea aparece entre las del operador.
    expect((await http().get('/api/tasks').set(auth(a.token))).body.some((t: { id: string }) => t.id === tarea.id)).toBe(true);
  });

  it('rechaza responsables que no son usuarios internos y activos de la empresa', async () => {
    expect((await fijar(a.token, { responsableOcAtrasadaId: proveedorUserId })).status).toBe(400); // externo
    expect((await fijar(a.token, { responsableOcAtrasadaId: b.userId })).status).toBe(400); // de otra empresa
    expect((await fijar(a.token, { responsableOcAtrasadaId: '3f2b1c9e-0000-4000-8000-000000000000' })).status).toBe(400); // no existe
    expect((await fijar(a.token, { responsableOcAtrasadaId: 'no-es-un-id' })).status).toBe(400); // formato
    expect((await fijar(a.token, { responsableSkuRojoId: proveedorUserId })).status).toBe(400);
    // Lo rechazado no cambió nada.
    expect((await http().get('/api/tenant-config').set(auth(a.token))).body.configuracion.excepciones.responsableOcAtrasadaId).toBe(operadorId);
  });

  it('si el responsable se desactiva, la tarea nueva queda sin responsable en vez de fallar', async () => {
    await prisma().user.update({ where: { id: operadorId }, data: { activo: false } });
    const { id } = await ocAtrasada(`OC-R2-${suffix}`);
    await http().post('/api/exceptions/evaluar').set(auth(a.token));
    const caso = (await casos(a.token)).find((c) => c.clave === id)!;
    expect(caso.taskId).toBeTruthy();
    expect((await prisma().task.findUniqueOrThrow({ where: { id: caso.taskId! } })).asignadoAId).toBeNull();
  });

  it('se puede quitar el responsable dejándolo vacío', async () => {
    expect((await fijar(a.token, { responsableOcAtrasadaId: '' })).status).toBe(200);
    expect((await http().get('/api/tenant-config').set(auth(a.token))).body.configuracion.excepciones.responsableOcAtrasadaId).toBe('');
  });

  it('el responsable de una empresa no afecta a otra', async () => {
    expect((await http().get('/api/tenant-config').set(auth(b.token))).body.configuracion.excepciones).toMatchObject({ responsableOcAtrasadaId: '', responsableSkuRojoId: '', responsableDocumentoFaltanteId: '' });
  });
});
