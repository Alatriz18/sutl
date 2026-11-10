import { INestApplication } from '@nestjs/common';
import { createServer, IncomingMessage, Server } from 'http';
import { AddressInfo } from 'net';
import * as request from 'supertest';
import { createTestApp } from './test-app';
import { auth, crearTenantConAdmin } from './test-helpers';

type Notif = { id: string; estado: string; intentos: number; error: string | null; destino: string | null; enviadoAt: string | null };

// Envío real de notificaciones: el correo sale por SMTP hacia Mailpit (Docker
// Compose / servicio del CI) y WhatsApp contra un servidor local que imita la
// Cloud API de Meta. Pasan por la cola real (BullMQ + Redis) con reintentos.
describe('Notificaciones reales (e2e)', () => {
  let app: INestApplication;
  const suffix = Date.now();
  let a: { token: string; userId: string; email: string };
  let b: { token: string };
  let stub: Server;
  let llamadas: { auth?: string; body: Record<string, unknown> }[] = [];
  let respuestas: { status: number; json?: unknown }[] = [];
  const MAILPIT = process.env.MAILPIT_URL ?? 'http://localhost:8025';

  const http = () => request(app.getHttpServer());
  const lista = async (token: string) => (await http().get('/api/notifications').set(auth(token))).body as Notif[];

  async function esperarEstado(token: string, id: string, estado: string, ms = 8000) {
    const limite = Date.now() + ms;
    while (Date.now() < limite) {
      const n = (await lista(token)).find((x) => x.id === id);
      if (n?.estado === estado) return n;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(`La notificación ${id} no llegó a "${estado}" a tiempo: ${JSON.stringify((await lista(token)).find((x) => x.id === id))}`);
  }

  async function correosPara(asunto: string): Promise<{ To: { Address: string }[]; Subject: string }[]> {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`subject:"${asunto}"`)}`);
    return ((await res.json()) as { messages: { To: { Address: string }[]; Subject: string }[] }).messages;
  }

  beforeAll(async () => {
    stub = createServer((req: IncomingMessage, res) => {
      let cuerpo = '';
      req.on('data', (c) => (cuerpo += c));
      req.on('end', () => {
        llamadas.push({ auth: req.headers.authorization, body: JSON.parse(cuerpo || '{}') });
        const r = respuestas.shift() ?? { status: 200, json: { messages: [{ id: 'wamid.X' }] } };
        res.writeHead(r.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(r.json ?? {}));
      });
    });
    await new Promise<void>((ok) => stub.listen(0, '127.0.0.1', ok));
    process.env.WHATSAPP_API_URL = `http://127.0.0.1:${(stub.address() as AddressInfo).port}`;
    process.env.WHATSAPP_TOKEN = 'token-secreto-de-prueba';
    process.env.WHATSAPP_PHONE_ID = '1234567890';
    process.env.SMTP_HOST ??= 'localhost';
    process.env.SMTP_PORT ??= '1025';
    process.env.SMTP_FROM ??= 'SUTL <notificaciones@sutl.local>';

    app = await createTestApp();
    const ta = await crearTenantConAdmin(app, `NotifA${suffix}`);
    a = ta;
    b = await crearTenantConAdmin(app, `NotifB${suffix}`);
  });

  afterAll(async () => {
    await app.close();
    await new Promise((r) => stub.close(r));
  });

  beforeEach(() => {
    llamadas = [];
    respuestas = [];
  });

  it('informa qué canales están conectados', async () => {
    const r = await http().get('/api/notifications/canales').set(auth(a.token));
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ email: true, whatsapp: true, push: false, sms: false });
  });

  describe('correo', () => {
    it('sale por SMTP, llega al destinatario y la notificación queda enviada', async () => {
      const asunto = `Embarque listo ${suffix}`;
      const r = await http().post('/api/notifications').set(auth(a.token)).send({
        canal: 'email', tipo: 'aviso', asunto, mensaje: 'Tu embarque salió de puerto.', destino: `cliente-${suffix}@ejemplo.com`,
      });
      expect(r.status).toBe(201);
      const n = await esperarEstado(a.token, r.body.id, 'enviado');
      expect(n.intentos).toBe(1);
      expect(n.enviadoAt).toBeTruthy();
      expect(n.error).toBeNull();

      const correos = await correosPara(asunto);
      expect(correos).toHaveLength(1);
      expect(correos[0].To[0].Address).toBe(`cliente-${suffix}@ejemplo.com`);
    });

    it('sin destino usa el correo del usuario destinatario', async () => {
      const asunto = `A mi usuario ${suffix}`;
      const r = await http().post('/api/notifications').set(auth(a.token)).send({
        canal: 'email', tipo: 'aviso', asunto, mensaje: 'Hola', userId: a.userId,
      });
      expect(r.status).toBe(201);
      expect(r.body.destino).toBe(a.email);
      await esperarEstado(a.token, r.body.id, 'enviado');
      expect((await correosPara(asunto))[0].To[0].Address).toBe(a.email);
    });

    it('un asunto con saltos de línea no inyecta cabeceras', async () => {
      const r = await http().post('/api/notifications').set(auth(a.token)).send({
        canal: 'email', tipo: 'aviso', asunto: `Hola ${suffix}\r\nBcc: robado@ejemplo.com`, mensaje: 'x', destino: 'ok@ejemplo.com',
      });
      expect(r.status).toBe(201);
      await esperarEstado(a.token, r.body.id, 'enviado');
      const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`subject:"Hola ${suffix}"`)}`);
      const msgs = ((await res.json()) as { messages: { Bcc: unknown[] }[] }).messages;
      expect(msgs).toHaveLength(1);
      expect(msgs[0].Bcc).toHaveLength(0);
    });
  });

  describe('WhatsApp', () => {
    const base = { canal: 'whatsapp', tipo: 'aviso', asunto: 'Tu envío', mensaje: 'Llega mañana.', destino: '+593991234567' };

    it('llama a la Cloud API con el token y el teléfono sin "+"', async () => {
      const r = await http().post('/api/notifications').set(auth(a.token)).send(base);
      expect(r.status).toBe(201);
      await esperarEstado(a.token, r.body.id, 'enviado');
      expect(llamadas).toHaveLength(1);
      expect(llamadas[0].auth).toBe('Bearer token-secreto-de-prueba');
      expect(llamadas[0].body).toMatchObject({ messaging_product: 'whatsapp', to: '593991234567', type: 'text' });
      expect(JSON.stringify(llamadas[0].body)).toContain('Llega mañana.');
    });

    it('un 4xx del proveedor es definitivo: falla sin reintentos y no filtra el token', async () => {
      respuestas = [{ status: 400, json: { error: { message: 'Recipient phone number not in allowed list' } } }];
      const r = await http().post('/api/notifications').set(auth(a.token)).send(base);
      const n = await esperarEstado(a.token, r.body.id, 'fallido');
      expect(n.intentos).toBe(1);
      expect(llamadas).toHaveLength(1);
      expect(n.error).toMatch(/400.*allowed list/);
      expect(n.error).not.toContain('token-secreto-de-prueba');
    });

    it('un 5xx se reintenta (3 intentos) y si se recupera queda enviada', async () => {
      respuestas = [{ status: 503 }, { status: 503 }];
      const r = await http().post('/api/notifications').set(auth(a.token)).send(base);
      const n = await esperarEstado(a.token, r.body.id, 'enviado');
      expect(n.intentos).toBe(3);
      expect(llamadas).toHaveLength(3);
    });

    it('si los 3 intentos fallan queda fallida y se puede reenviar a mano', async () => {
      respuestas = [{ status: 503 }, { status: 503 }, { status: 503 }];
      const r = await http().post('/api/notifications').set(auth(a.token)).send(base);
      const n = await esperarEstado(a.token, r.body.id, 'fallido');
      expect(n.intentos).toBe(3);
      expect(n.error).toMatch(/503/);

      const re = await http().post(`/api/notifications/${r.body.id}/reenviar`).set(auth(a.token));
      expect(re.status).toBe(201);
      await esperarEstado(a.token, r.body.id, 'enviado');
    });
  });

  describe('validación y seguridad', () => {
    const post = (token: string, body: Record<string, unknown>) => http().post('/api/notifications').set(auth(token)).send(body);
    const ok = { canal: 'email', tipo: 'aviso', asunto: 'x', mensaje: 'y', destino: 'ok@ejemplo.com' };

    it('rechaza correo inválido, teléfono sin formato internacional y falta de destino', async () => {
      expect((await post(a.token, { ...ok, destino: 'no-es-correo' })).status).toBe(400);
      expect((await post(a.token, { ...ok, destino: 'a@b.com, c@d.com' })).status).toBe(400);
      expect((await post(a.token, { ...ok, canal: 'whatsapp', destino: '0991234567' })).status).toBe(400);
      expect((await post(a.token, { ...ok, destino: undefined })).status).toBe(400);
      expect((await post(a.token, { ...ok, canal: 'whatsapp', destino: undefined })).status).toBe(400);
    });

    it('push y SMS no están disponibles y se dice claro', async () => {
      const r = await post(a.token, { ...ok, canal: 'sms' });
      expect(r.status).toBe(400);
      expect(r.body.message).toMatch(/todavía no está disponible/);
    });

    it('limita el tamaño del mensaje', async () => {
      expect((await post(a.token, { ...ok, mensaje: 'x'.repeat(4001) })).status).toBe(400);
    });

    it('no se puede apuntar a un usuario de otra empresa', async () => {
      const r = await post(b.token, { ...ok, destino: undefined, userId: a.userId });
      expect(r.status).toBe(404);
    });

    it('reenviar una enviada o inexistente no hace nada', async () => {
      const creada = await post(a.token, ok);
      await esperarEstado(a.token, creada.body.id, 'enviado');
      expect((await http().post(`/api/notifications/${creada.body.id}/reenviar`).set(auth(a.token))).status).toBe(400);
      expect((await http().post('/api/notifications/00000000-0000-4000-8000-000000000000/reenviar').set(auth(a.token))).status).toBe(404);
    });

    it('aislamiento: otra empresa no ve ni reenvía las notificaciones de A', async () => {
      respuestas = [{ status: 400, json: { error: { message: 'x' } } }];
      const r = await post(a.token, { canal: 'whatsapp', tipo: 'aviso', asunto: 'a', mensaje: 'b', destino: '+593991234567' });
      await esperarEstado(a.token, r.body.id, 'fallido');
      expect((await lista(b.token)).some((n) => n.id === r.body.id)).toBe(false);
      expect((await http().post(`/api/notifications/${r.body.id}/reenviar`).set(auth(b.token))).status).toBe(404);
    });

    it('sin sesión recibe 401', async () => {
      expect((await http().get('/api/notifications')).status).toBe(401);
    });
  });
});
