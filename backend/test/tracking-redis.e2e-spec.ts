import { INestApplication } from '@nestjs/common';
import * as http from 'http';
import * as request from 'supertest';
import { createTestApp } from './test-app';
import { auth, crearTenantConAdmin, ENVIO_BASE } from './test-helpers';

// Seguimiento en vivo con VARIAS réplicas del backend: una conexión abierta en la réplica A recibe los eventos
// que se registran en la réplica B (difusión por Redis), una sola vez, y nadie cruza empresas.
describe('Seguimiento en vivo entre réplicas (e2e)', () => {
  let appA: INestApplication;
  let appB: INestApplication;
  let puertoA: number;
  const suffix = Date.now();
  const limiteLoginOriginal = process.env.LOGIN_RATE_LIMIT;
  let a: Awaited<ReturnType<typeof crearTenantConAdmin>>;
  let b: Awaited<ReturnType<typeof crearTenantConAdmin>>;
  const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

  function abrirStream(port: number, path: string) {
    return new Promise<{ leer: () => string; cerrar: () => void; esperar: (texto: string, ms?: number) => Promise<string> }>((resolve, reject) => {
      const req = http.get({ host: '127.0.0.1', port, path, headers: { Accept: 'text/event-stream' } }, (res) => {
        let buffer = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (buffer += c));
        res.on('error', () => undefined);
        resolve({
          leer: () => buffer,
          cerrar: () => req.destroy(),
          esperar: (texto, ms = 5000) =>
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

  async function crearEnvio(token: string) {
    const r = await request(appB.getHttpServer()).post('/api/shipments').set(auth(token)).send(ENVIO_BASE);
    expect(r.status).toBe(201);
    return { id: r.body.id as string, codigo: r.body.codigoGuia as string };
  }
  const registrarEnB = (token: string, shipmentId: string, ubicacion: string) =>
    request(appB.getHttpServer()).post('/api/tracking-events').set(auth(token)).send({ shipmentId, estado: 'en_transito', ubicacion });

  beforeAll(async () => {
    process.env.LOGIN_RATE_LIMIT = '1000';
    appA = await createTestApp();
    await appA.listen(0);
    puertoA = (appA.getHttpServer().address() as { port: number }).port;
    appB = await createTestApp();
    await appB.listen(0);
    a = await crearTenantConAdmin(appB, `Redis A ${suffix}`);
    b = await crearTenantConAdmin(appB, `Redis B ${suffix}`);
    // Da tiempo a que las dos réplicas terminen de suscribirse al canal de Redis.
    await espera(800);
  });

  afterAll(async () => {
    process.env.LOGIN_RATE_LIMIT = limiteLoginOriginal;
    await appA.close();
    await appB.close();
  });

  it('un evento registrado en la réplica B llega, una sola vez, a la conexión abierta en la réplica A', async () => {
    const envio = await crearEnvio(a.token);
    const stream = await abrirStream(puertoA, `/api/shipments/tracking/${envio.codigo}/stream`);
    try {
      expect((await registrarEnB(a.token, envio.id, 'Puerto de Shanghái')).status).toBe(201);
      const recibido = await stream.esperar('Puerto de Shanghái');
      expect(recibido.match(/Puerto de Shanghái/g)).toHaveLength(1);
      // Un segundo evento llega también (y el primero no se repite).
      expect((await registrarEnB(a.token, envio.id, 'Canal de Panamá')).status).toBe(201);
      const todo = await stream.esperar('Canal de Panamá');
      expect(todo.match(/Puerto de Shanghái/g)).toHaveLength(1);
      expect(todo.match(/Canal de Panamá/g)).toHaveLength(1);
    } finally {
      stream.cerrar();
    }
  });

  it('los eventos de otra empresa no llegan a una conexión que no es suya', async () => {
    const envioA = await crearEnvio(a.token);
    const envioB = await crearEnvio(b.token);
    const stream = await abrirStream(puertoA, `/api/shipments/tracking/${envioA.codigo}/stream`);
    try {
      expect((await registrarEnB(b.token, envioB.id, 'Secreto de la empresa B')).status).toBe(201);
      expect((await registrarEnB(a.token, envioA.id, 'Dato propio')).status).toBe(201);
      const recibido = await stream.esperar('Dato propio');
      expect(recibido).not.toContain('Secreto de la empresa B');
    } finally {
      stream.cerrar();
    }
  });

  it('las dos réplicas cierran limpio (sin conexiones a Redis colgadas)', async () => {
    // afterAll hace app.close(); aquí solo se comprueba que seguir publicando en B no falla mientras A está viva.
    const envio = await crearEnvio(a.token);
    expect((await registrarEnB(a.token, envio.id, 'Otra más')).status).toBe(201);
  });
});
