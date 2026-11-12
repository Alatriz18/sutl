import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './test-app';
import { auth, crearTenantConAdmin, superAdminToken } from './test-helpers';

// Formulario de contacto de la landing (público): validación, trampa para
// bots, una solicitud por correo al día, límite por IP y acceso solo de super_admin.
describe('Contactos de la landing (e2e)', () => {
  let app: INestApplication;
  const suffix = Date.now();
  const limiteOriginal = process.env.LEADS_RATE_LIMIT;
  const loginOriginal = process.env.LOGIN_RATE_LIMIT;
  const http = () => request(app.getHttpServer());
  const valido = (n: string) => ({ nombre: 'Ana Pérez', empresa: `Empresa ${suffix}`, email: `ana-${n}-${suffix}@ejemplo.com`, mensaje: 'Quiero un diagnóstico' });
  const cuenta = (email: string) => app.get(PrismaService).lead.count({ where: { email: email.toLowerCase() } });

  beforeAll(async () => {
    process.env.LEADS_RATE_LIMIT = '1000';
    process.env.LOGIN_RATE_LIMIT = '1000';
    app = await createTestApp();
  });

  afterAll(async () => {
    process.env.LEADS_RATE_LIMIT = limiteOriginal;
    process.env.LOGIN_RATE_LIMIT = loginOriginal;
    await app.close();
  });

  it('es público: guarda el contacto sin sesión', async () => {
    const body = valido('a');
    const r = await http().post('/api/leads').send(body);
    expect(r.status).toBe(201);
    expect(r.body).toEqual({ ok: true });
    expect(await cuenta(body.email)).toBe(1);
  });

  it('el mismo correo el mismo día no se duplica y responde igual', async () => {
    const body = valido('b');
    await http().post('/api/leads').send(body);
    const r = await http().post('/api/leads').send({ ...body, email: body.email.toUpperCase() });
    expect(r.status).toBe(201);
    expect(await cuenta(body.email)).toBe(1);
  });

  it('un bot que llena el campo trampa recibe 201 pero no se guarda nada', async () => {
    const body = { ...valido('bot'), sitioWeb: 'http://spam.com' };
    const r = await http().post('/api/leads').send(body);
    expect(r.status).toBe(201);
    expect(await cuenta(body.email)).toBe(0);
  });

  it.each([
    ['sin nombre', { nombre: '' }],
    ['nombre de 1 letra', { nombre: 'A' }],
    ['sin empresa', { empresa: '' }],
    ['correo inválido', { email: 'no-es-correo' }],
    ['teléfono inválido', { telefono: 'abc' }],
    ['mensaje enorme', { mensaje: 'x'.repeat(1001) }],
    ['campos desconocidos', { rol: 'super_admin' }],
  ])('rechaza %s', async (_n, extra) => {
    const r = await http().post('/api/leads').send({ ...valido('v'), ...extra });
    expect(r.status).toBe(400);
  });

  it('la respuesta no revela nada interno', async () => {
    const r = await http().post('/api/leads').send(valido('c'));
    expect(JSON.stringify(r.body)).toBe('{"ok":true}');
  });

  it('el límite por IP responde 429 al excederse', async () => {
    process.env.LEADS_RATE_LIMIT = '3';
    try {
      // Las peticiones anteriores de esta suite ya cuentan en la ventana de 1 hora: se excede seguro.
      const estados: number[] = [];
      for (let i = 0; i < 4; i++) estados.push((await http().post('/api/leads').send(valido(`l${i}`))).status);
      expect(estados).toContain(429);
    } finally {
      process.env.LEADS_RATE_LIMIT = '1000';
    }
  });

  it('listar es solo de super_admin: sin sesión 401 y un admin de empresa 403', async () => {
    expect((await http().get('/api/leads')).status).toBe(401);
    const t = await crearTenantConAdmin(app, `Leads${suffix}`);
    expect((await http().get('/api/leads').set(auth(t.token))).status).toBe(403);
    const sa = await superAdminToken(app);
    const r = await http().get('/api/leads').set(auth(sa));
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);
  });
});
