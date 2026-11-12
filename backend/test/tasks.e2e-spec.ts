import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './test-app';
import { auth, crearTenantConAdmin, loginAs, PASSWORD, superAdminToken } from './test-helpers';

// Workflow humano: tareas con responsable, comentarios y bitácora de quién hizo qué.
describe('Tareas, comentarios y bitácora (e2e)', () => {
  let app: INestApplication;
  const suffix = Date.now();
  const limiteLoginOriginal = process.env.LOGIN_RATE_LIMIT;
  let a: Awaited<ReturnType<typeof crearTenantConAdmin>>;
  let b: Awaited<ReturnType<typeof crearTenantConAdmin>>;
  let operador: { userId: string; token: string };
  let operador2: { userId: string; token: string };
  const http = () => request(app.getHttpServer());

  async function nuevoOperador(tenantId: string, n: string) {
    const sa = await superAdminToken(app);
    const email = `op-${n}-${suffix}@e2e-test.com`;
    const r = await http().post('/api/auth/register').set(auth(sa)).send({ tenantId, email, password: PASSWORD, nombre: `Operador ${n}` });
    expect(r.status).toBe(201);
    return { userId: r.body.id as string, token: await loginAs(app, email) };
  }

  beforeAll(async () => {
    process.env.LOGIN_RATE_LIMIT = '1000';
    app = await createTestApp();
    a = await crearTenantConAdmin(app, `Tareas A ${suffix}`);
    b = await crearTenantConAdmin(app, `Tareas B ${suffix}`);
    operador = await nuevoOperador(a.tenantId, 'uno');
    operador2 = await nuevoOperador(a.tenantId, 'dos');
  });

  afterAll(async () => {
    process.env.LOGIN_RATE_LIMIT = limiteLoginOriginal;
    await app.close();
  });

  it('exige sesión', async () => {
    expect((await http().get('/api/tasks')).status).toBe(401);
  });

  it('el administrador crea una tarea con responsable y fecha, y queda en la bitácora', async () => {
    const r = await http()
      .post('/api/tasks')
      .set(auth(a.token))
      .send({ titulo: 'Confirmar fecha con el proveedor', asignadoAId: operador.userId, prioridad: 'alta', fechaLimite: '2026-12-01T00:00:00.000Z', entidadTipo: 'sku', entidadId: 'SKU-1' });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ estado: 'abierta', prioridad: 'alta', asignadoAId: operador.userId, creadoPorId: a.userId, tenantId: a.tenantId });

    const d = await http().get(`/api/tasks/${r.body.id}`).set(auth(operador.token));
    expect(d.status).toBe(200);
    expect(d.body.bitacora.map((x: { accion: string }) => x.accion)).toEqual(['tarea.creada']);
    expect(d.body.bitacora[0].user.id).toBe(a.userId);
  });

  it('valida los datos', async () => {
    const mal = async (body: object) => (await http().post('/api/tasks').set(auth(a.token)).send(body)).status;
    expect(await mal({})).toBe(400);
    expect(await mal({ titulo: '' })).toBe(400);
    expect(await mal({ titulo: 'x', prioridad: 'urgentisima' })).toBe(400);
    expect(await mal({ titulo: 'x', entidadTipo: 'orden_compra' })).toBe(400);
    expect(await mal({ titulo: 'x', rol: 'super_admin' })).toBe(400);
    expect(await mal({ titulo: 'x'.repeat(161) })).toBe(400);
  });

  it('no se puede asignar ni enlazar con datos de otra empresa', async () => {
    const ajeno = await http().post('/api/tasks').set(auth(a.token)).send({ titulo: 'x', asignadoAId: b.userId });
    expect(ajeno.status).toBe(404);
    const oc = await http().post('/api/tasks').set(auth(a.token)).send({ titulo: 'x', entidadTipo: 'orden_compra', entidadId: '00000000-0000-4000-8000-000000000000' });
    expect(oc.status).toBe(404);
  });

  it('una tarea de una empresa es invisible para la otra (listado, detalle, cambio y comentario)', async () => {
    const t = await http().post('/api/tasks').set(auth(a.token)).send({ titulo: `Privada ${suffix}` });
    expect(t.status).toBe(201);
    const lista = await http().get('/api/tasks').set(auth(b.token));
    expect(lista.body.some((x: { id: string }) => x.id === t.body.id)).toBe(false);
    expect((await http().get(`/api/tasks/${t.body.id}`).set(auth(b.token))).status).toBe(404);
    expect((await http().patch(`/api/tasks/${t.body.id}`).set(auth(b.token)).send({ titulo: 'hack' })).status).toBe(404);
    expect((await http().post(`/api/tasks/${t.body.id}/comments`).set(auth(b.token)).send({ texto: 'hack' })).status).toBe(404);
  });

  it('un operador ajeno a la tarea no la modifica, pero sí puede comentarla; el responsable la completa', async () => {
    const t = await http().post('/api/tasks').set(auth(a.token)).send({ titulo: 'Revisar OC', asignadoAId: operador.userId });
    const id = t.body.id as string;
    expect((await http().patch(`/api/tasks/${id}`).set(auth(operador2.token)).send({ estado: 'hecha' })).status).toBe(403);
    expect((await http().post(`/api/tasks/${id}/comments`).set(auth(operador2.token)).send({ texto: 'Yo lo vi ayer' })).status).toBe(201);

    const hecha = await http().patch(`/api/tasks/${id}`).set(auth(operador.token)).send({ estado: 'hecha' });
    expect(hecha.status).toBe(200);
    expect(hecha.body.estado).toBe('hecha');
    expect(hecha.body.completadaAt).not.toBeNull();

    const reabierta = await http().patch(`/api/tasks/${id}`).set(auth(a.token)).send({ estado: 'abierta' });
    expect(reabierta.body.completadaAt).toBeNull();

    const d = await http().get(`/api/tasks/${id}`).set(auth(a.token));
    expect(d.body.comentarios).toHaveLength(1);
    expect(d.body.comentarios[0].autor.id).toBe(operador2.userId);
    expect(d.body.bitacora.map((x: { accion: string }) => x.accion)).toEqual(['tarea.creada', 'tarea.comentada', 'tarea.hecha', 'tarea.abierta']);
  });

  it('una tarea cancelada no se edita hasta reabrirla, y no se puede borrar', async () => {
    const t = await http().post('/api/tasks').set(auth(a.token)).send({ titulo: 'Se cancela' });
    const id = t.body.id as string;
    expect((await http().patch(`/api/tasks/${id}`).set(auth(a.token)).send({ estado: 'cancelada' })).status).toBe(200);
    expect((await http().patch(`/api/tasks/${id}`).set(auth(a.token)).send({ titulo: 'otro' })).status).toBe(409);
    expect((await http().delete(`/api/tasks/${id}`).set(auth(a.token))).status).toBe(404);
  });

  it('filtros: mis tareas y por estado', async () => {
    const t = await http().post('/api/tasks').set(auth(a.token)).send({ titulo: `Mía ${suffix}`, asignadoAId: operador2.userId });
    const mias = await http().get('/api/tasks?mias=true').set(auth(operador2.token));
    expect(mias.status).toBe(200);
    expect(mias.body.every((x: { asignadoAId: string }) => x.asignadoAId === operador2.userId)).toBe(true);
    expect(mias.body.some((x: { id: string }) => x.id === t.body.id)).toBe(true);
    expect((await http().get('/api/tasks?estado=inventado').set(auth(a.token))).status).toBe(400);
    const hechas = await http().get('/api/tasks?estado=hecha').set(auth(a.token));
    expect(hechas.body.every((x: { estado: string }) => x.estado === 'hecha')).toBe(true);
  });

  it('la bitácora de la empresa la ve solo su administrador y no mezcla empresas', async () => {
    expect((await http().get('/api/audit').set(auth(operador.token))).status).toBe(403);
    const ver = await http().get('/api/audit?entidad=tarea').set(auth(a.token));
    expect(ver.status).toBe(200);
    expect(ver.body.length).toBeGreaterThan(0);
    const propia = await app.get(PrismaService).auditLog.count({ where: { tenantId: a.tenantId } });
    expect(propia).toBeGreaterThan(0);
    const deB = await http().get('/api/audit?entidad=tarea').set(auth(b.token));
    expect(deB.body.every((x: { user: { id: string } | null }) => x.user === null || x.user.id !== a.userId)).toBe(true);
  });
});
