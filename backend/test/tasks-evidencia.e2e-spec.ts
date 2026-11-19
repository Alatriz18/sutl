import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './test-app';
import { auth, crearTenantConAdmin, PASSWORD } from './test-helpers';

const PDF = Buffer.from('%PDF-1.4 evidencia de la tarea');

// Evidencia adjunta a las tareas: quién puede subirla, quién la descarga y que nunca cruce de empresa.
describe('Evidencia de tareas (e2e)', () => {
  let app: INestApplication;
  const suffix = Date.now();
  const limiteLoginOriginal = process.env.LOGIN_RATE_LIMIT;
  let a: Awaited<ReturnType<typeof crearTenantConAdmin>>;
  let b: Awaited<ReturnType<typeof crearTenantConAdmin>>;
  let tokenOp: string;
  let tokenAjeno: string;
  let opId: string;
  let tareaId: string;
  let adjuntoId: string;
  const http = () => request(app.getHttpServer());

  async function usuario(email: string, rol: string) {
    const r = await http().post('/api/users').set(auth(a.token)).send({ email, password: PASSWORD, nombre: email, rol });
    expect(r.status).toBe(201);
    const l = await http().post('/api/auth/login').send({ email, password: PASSWORD });
    return { id: r.body.id as string, token: l.body.accessToken as string };
  }

  beforeAll(async () => {
    process.env.LOGIN_RATE_LIMIT = '1000';
    app = await createTestApp();
    a = await crearTenantConAdmin(app, `Evid A ${suffix}`);
    b = await crearTenantConAdmin(app, `Evid B ${suffix}`);
    const op = await usuario(`evid-op-${suffix}@e2e-test.com`, 'operador');
    opId = op.id;
    tokenOp = op.token;
    tokenAjeno = (await usuario(`evid-op2-${suffix}@e2e-test.com`, 'operador')).token;
    const t = await http().post('/api/tasks').set(auth(a.token)).send({ titulo: 'Entregar la carga', asignadoAId: opId });
    tareaId = t.body.id;
  });

  afterAll(async () => {
    process.env.LOGIN_RATE_LIMIT = limiteLoginOriginal;
    await app.close();
  });

  it('el responsable adjunta evidencia y aparece en la tarea sin exponer la ruta del disco', async () => {
    const r = await http().post(`/api/tasks/${tareaId}/adjuntos`).set(auth(tokenOp)).attach('file', PDF, 'foto-entrega.pdf');
    expect(r.status).toBe(201);
    adjuntoId = r.body.id;
    expect(r.body).toMatchObject({ nombreArchivo: 'foto-entrega.pdf', tamano: PDF.length });
    const t = await http().get(`/api/tasks/${tareaId}`).set(auth(a.token));
    expect(t.body.adjuntos).toHaveLength(1);
    expect(JSON.stringify(t.body)).not.toContain('uploads');
    expect(JSON.stringify(t.body)).not.toContain('urlArchivo');
    expect(t.body.bitacora.some((x: { accion: string }) => x.accion === 'tarea.evidencia_adjuntada')).toBe(true);
  });

  it('se descarga con el mismo contenido', async () => {
    const d = await http().get(`/api/tasks/${tareaId}/adjuntos/${adjuntoId}/download`).set(auth(a.token)).buffer(true).parse((res, cb) => {
      const partes: Buffer[] = [];
      res.on('data', (c: Buffer) => partes.push(c));
      res.on('end', () => cb(null, Buffer.concat(partes)));
    });
    expect(d.status).toBe(200);
    expect((d.body as Buffer).equals(PDF)).toBe(true);
  });

  it('otro operador que no creó ni tiene la tarea no puede adjuntar', async () => {
    expect((await http().post(`/api/tasks/${tareaId}/adjuntos`).set(auth(tokenAjeno)).attach('file', PDF, 'x.pdf')).status).toBe(403);
  });

  it('rechaza tipos no permitidos y la falta de archivo', async () => {
    expect((await http().post(`/api/tasks/${tareaId}/adjuntos`).set(auth(a.token)).attach('file', Buffer.from('MZ'), 'virus.exe')).status).toBe(400);
    expect((await http().post(`/api/tasks/${tareaId}/adjuntos`).set(auth(a.token))).status).toBe(400);
  });

  it('otra empresa no ve ni descarga la evidencia (404 uniforme)', async () => {
    expect((await http().post(`/api/tasks/${tareaId}/adjuntos`).set(auth(b.token)).attach('file', PDF, 'x.pdf')).status).toBe(404);
    expect((await http().get(`/api/tasks/${tareaId}/adjuntos/${adjuntoId}/download`).set(auth(b.token))).status).toBe(404);
  });

  it('la descarga exige sesión y un adjunto que no es de esa tarea da 404', async () => {
    expect((await http().get(`/api/tasks/${tareaId}/adjuntos/${adjuntoId}/download`)).status).toBe(401);
    const otra = await http().post('/api/tasks').set(auth(a.token)).send({ titulo: 'Otra' });
    expect((await http().get(`/api/tasks/${otra.body.id}/adjuntos/${adjuntoId}/download`).set(auth(a.token))).status).toBe(404);
  });

  it('una tarea admite hasta 10 archivos', async () => {
    for (let i = 1; i < 10; i++) expect((await http().post(`/api/tasks/${tareaId}/adjuntos`).set(auth(a.token)).attach('file', PDF, `e${i}.pdf`)).status).toBe(201);
    expect((await http().post(`/api/tasks/${tareaId}/adjuntos`).set(auth(a.token)).attach('file', PDF, 'e11.pdf')).status).toBe(409);
  });
});
