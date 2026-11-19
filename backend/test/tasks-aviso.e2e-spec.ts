import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './test-app';
import { auth, crearTenantConAdmin, PASSWORD } from './test-helpers';

const MAILPIT = process.env.MAILPIT_URL ?? 'http://localhost:8025';

// Aviso por correo cuando a alguien le asignan una tarea.
describe('Aviso de tarea asignada (e2e)', () => {
  let app: INestApplication;
  const suffix = Date.now();
  const limiteLoginOriginal = process.env.LOGIN_RATE_LIMIT;
  let a: Awaited<ReturnType<typeof crearTenantConAdmin>>;
  let op: { id: string; email: string };
  const http = () => request(app.getHttpServer());
  const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

  async function asuntos(email: string, cantidad: number, ms = 8000) {
    const limite = Date.now() + ms;
    let m: { Subject: string }[] = [];
    while (Date.now() < limite) {
      const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
      m = ((await res.json()) as { messages: { Subject: string }[] }).messages ?? [];
      if (m.length >= cantidad) return m.map((x) => x.Subject);
      await espera(150);
    }
    return m.map((x) => x.Subject);
  }

  beforeAll(async () => {
    process.env.LOGIN_RATE_LIMIT = '1000';
    process.env.SMTP_HOST ??= 'localhost';
    process.env.SMTP_PORT ??= '1025';
    process.env.SMTP_FROM ??= 'SUTL <notificaciones@sutl.local>';
    app = await createTestApp();
    a = await crearTenantConAdmin(app, `TareaAviso ${suffix}`);
    const email = `tarea-op-${suffix}@e2e-test.com`;
    const r = await http().post('/api/users').set(auth(a.token)).send({ email, password: PASSWORD, nombre: 'Operador Tareas', rol: 'operador' });
    expect(r.status).toBe(201);
    op = { id: r.body.id, email };
  });

  afterAll(async () => {
    process.env.LOGIN_RATE_LIMIT = limiteLoginOriginal;
    await app.close();
  });

  it('al crear una tarea asignada a otra persona, esa persona recibe un correo', async () => {
    const t = await http().post('/api/tasks').set(auth(a.token)).send({ titulo: 'Llamar al proveedor', asignadoAId: op.id });
    expect(t.status).toBe(201);
    expect(await asuntos(op.email, 1)).toEqual(['SUTL: te asignaron una tarea — Llamar al proveedor']);
  });

  it('al reasignar una tarea, el nuevo responsable recibe el aviso; si no cambia el responsable, no hay otro correo', async () => {
    const t = await http().post('/api/tasks').set(auth(a.token)).send({ titulo: 'Revisar factura' });
    expect((await http().patch(`/api/tasks/${t.body.id}`).set(auth(a.token)).send({ asignadoAId: op.id })).status).toBe(200);
    expect(await asuntos(op.email, 2)).toHaveLength(2);
    await http().patch(`/api/tasks/${t.body.id}`).set(auth(a.token)).send({ prioridad: 'alta' });
    await espera(600);
    expect(await asuntos(op.email, 3, 600)).toHaveLength(2);
  });

  it('quien se asigna una tarea a sí mismo no recibe correo', async () => {
    await http().post('/api/tasks').set(auth(a.token)).send({ titulo: 'Para mí', asignadoAId: a.userId });
    await espera(600);
    expect((await asuntos(a.email, 1, 600)).filter((s) => s.includes('Para mí'))).toHaveLength(0);
  });
});
