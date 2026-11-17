import { INestApplication } from '@nestjs/common';
import * as http from 'http';
import * as request from 'supertest';
import { createTestApp } from './test-app';
import { auth, crearTenantConAdmin, ENVIO_BASE, loginAs, PASSWORD } from './test-helpers';

// Seguimiento en vivo (C7): los eventos nuevos llegan por Server-Sent Events a la página pública y al
// equipo/cliente dueño, sin datos internos, y nadie cruza empresas.
describe('Seguimiento en vivo (e2e)', () => {
  let app: INestApplication;
  let puerto: number;
  const suffix = Date.now();
  const limiteLoginOriginal = process.env.LOGIN_RATE_LIMIT;
  let a: Awaited<ReturnType<typeof crearTenantConAdmin>>;
  let b: Awaited<ReturnType<typeof crearTenantConAdmin>>;
  const emailCliente = `live-cli-${suffix}@live-test.com`;
  let tokenCliente: string;
  let tokenOtroCliente: string;
  const api = () => request(app.getHttpServer());

  // Abre una conexión SSE real y devuelve lo recibido hasta que se cierre o se pida cerrar.
  function abrirStream(path: string, token?: string) {
    return new Promise<{ status: number; leer: () => string; cerrar: () => void; esperar: (texto: string, ms?: number) => Promise<string> }>((resolve, reject) => {
      const req = http.get({ host: '127.0.0.1', port: puerto, path, headers: { Accept: 'text/event-stream', ...(token ? { Authorization: `Bearer ${token}` } : {}) } }, (res) => {
        let buffer = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (buffer += c));
        res.on('error', () => undefined);
        resolve({
          status: res.statusCode ?? 0,
          leer: () => buffer,
          cerrar: () => {
            req.destroy();
          },
          esperar: (texto, ms = 4000) =>
            new Promise<string>((ok, fail) => {
              const inicio = Date.now();
              const t = setInterval(() => {
                if (buffer.includes(texto)) {
                  clearInterval(t);
                  ok(buffer);
                } else if (Date.now() - inicio > ms) {
                  clearInterval(t);
                  fail(new Error(`No llegó «${texto}». Recibido: ${buffer}`));
                }
              }, 30);
            }),
        });
      });
      req.on('error', (e) => (e as NodeJS.ErrnoException).code === 'ECONNRESET' || reject(e));
    });
  }

  async function crearEnvio(token: string, destinatarioEmail?: string) {
    const r = await api().post('/api/shipments').set(auth(token)).send({ ...ENVIO_BASE, ...(destinatarioEmail ? { destinatarioEmail } : {}) });
    expect(r.status).toBe(201);
    return { id: r.body.id as string, codigo: r.body.codigoGuia as string };
  }
  const registrar = (token: string, shipmentId: string, extra: Record<string, unknown> = {}) =>
    api().post('/api/tracking-events').set(auth(token)).send({ shipmentId, estado: 'en_transito', ubicacion: 'Guayaquil', ...extra });

  beforeAll(async () => {
    process.env.LOGIN_RATE_LIMIT = '1000';
    app = await createTestApp();
    await app.listen(0);
    puerto = (app.getHttpServer().address() as { port: number }).port;
    a = await crearTenantConAdmin(app, `Live A ${suffix}`);
    b = await crearTenantConAdmin(app, `Live B ${suffix}`);
    for (const [email, nombre] of [[emailCliente, 'Cliente Live'], [`live-otro-${suffix}@live-test.com`, 'Otro cliente']]) {
      expect((await api().post('/api/users').set(auth(a.token)).send({ email, password: PASSWORD, nombre, rol: 'cliente_final' })).status).toBe(201);
    }
    tokenCliente = await loginAs(app, emailCliente);
    tokenOtroCliente = await loginAs(app, `live-otro-${suffix}@live-test.com`);
  });

  afterAll(async () => {
    process.env.LOGIN_RATE_LIMIT = limiteLoginOriginal;
    await app.close();
  });

  it('la ruta pública avisa del evento nuevo sin datos internos, con su ubicación en el mapa', async () => {
    const { id, codigo } = await crearEnvio(a.token);
    const s = await abrirStream(`/api/shipments/tracking/${codigo}/stream`);
    expect(s.status).toBe(200);
    expect((await registrar(a.token, id, { lat: -2.17, lng: -79.92, descripcion: 'Sale del puerto' })).status).toBe(201);
    const recibido = await s.esperar('Sale del puerto');
    s.cerrar();
    expect(recibido).toContain('"lat":-2.17');
    expect(recibido).toContain('"estado":"en_transito"');
    expect(recibido).not.toContain('responsable');
    expect(recibido).not.toContain(a.email);
    expect(recibido).not.toContain('tenantId');
  });

  it('un código inexistente no abre la conexión', async () => {
    expect((await api().get('/api/shipments/tracking/NO-EXISTE-XYZ/stream')).status).toBe(404);
  });

  it('la conexión pública solo recibe los eventos de su guía', async () => {
    const uno = await crearEnvio(a.token);
    const dos = await crearEnvio(a.token);
    const s = await abrirStream(`/api/shipments/tracking/${uno.codigo}/stream`);
    await registrar(a.token, dos.id, { descripcion: 'Evento de la otra guía' });
    await registrar(a.token, uno.id, { descripcion: 'Evento de mi guía' });
    const recibido = await s.esperar('Evento de mi guía');
    s.cerrar();
    expect(recibido).not.toContain('Evento de la otra guía');
  });

  it('el equipo exige sesión y solo ve los envíos de su empresa', async () => {
    const { id } = await crearEnvio(a.token);
    expect((await api().get(`/api/tracking-events/shipment/${id}/stream`)).status).toBe(401);
    expect((await api().get(`/api/tracking-events/shipment/${id}/stream`).set(auth(b.token))).status).toBe(404);
    const s = await abrirStream(`/api/tracking-events/shipment/${id}/stream`, a.token);
    expect(s.status).toBe(200);
    await registrar(a.token, id, { descripcion: 'Llegó a la aduana' });
    const recibido = await s.esperar('Llegó a la aduana');
    s.cerrar();
    expect(recibido).toContain(`"shipmentId":"${id}"`);
    expect(recibido).not.toContain('responsable');
  });

  it('el cliente final solo sigue en vivo SUS envíos', async () => {
    const mio = await crearEnvio(a.token, emailCliente);
    const ajeno = await crearEnvio(a.token, `otro-${suffix}@live-test.com`);
    expect((await api().get(`/api/tracking-events/shipment/${ajeno.id}/stream`).set(auth(tokenCliente))).status).toBe(404);
    expect((await api().get(`/api/tracking-events/shipment/${mio.id}/stream`).set(auth(tokenOtroCliente))).status).toBe(404);
    const s = await abrirStream(`/api/tracking-events/shipment/${mio.id}/stream`, tokenCliente);
    expect(s.status).toBe(200);
    await registrar(a.token, mio.id, { descripcion: 'En reparto' });
    await s.esperar('En reparto');
    s.cerrar();
  });

  it('las coordenadas deben ser válidas', async () => {
    const { id } = await crearEnvio(a.token);
    expect((await registrar(a.token, id, { lat: 91, lng: 0 })).status).toBe(400);
    expect((await registrar(a.token, id, { lat: 0, lng: -181 })).status).toBe(400);
    expect((await registrar(a.token, id, { lat: -90, lng: 180 })).status).toBe(201);
  });

  it('la página pública también muestra las coordenadas del historial, y nada interno', async () => {
    const { id, codigo } = await crearEnvio(a.token);
    await registrar(a.token, id, { lat: 10.5, lng: -66.9 });
    const r = await api().get(`/api/shipments/tracking/${codigo}`);
    expect(r.status).toBe(200);
    expect(r.body.eventos[0]).toMatchObject({ lat: 10.5, lng: -66.9 });
    expect(JSON.stringify(r.body)).not.toContain('responsable');
  });
});
