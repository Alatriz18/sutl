import { INestApplication } from '@nestjs/common';
import { createServer, IncomingMessage, Server } from 'http';
import { AddressInfo } from 'net';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { verificarFirma } from '../src/modules/webhooks/webhook-events';
import { createTestApp } from './test-app';
import { ENVIO_BASE, PASSWORD, auth, crearTenantConAdmin, loginAs, superAdminToken } from './test-helpers';

type Recibida = { headers: IncomingMessage['headers']; cuerpo: string; json: { id: string; evento: string; datos: Record<string, unknown> } };
type Entrega = { id: string; evento: string; estado: string; intentos: number; ultimoStatus: number | null; error: string | null };

// API pública v1 (X-API-Key) y webhooks por empresa contra Postgres, Redis y un
// receptor HTTP local: firma, reintentos, aislamiento entre empresas y SSRF.
describe('API pública v1 y webhooks (e2e)', () => {
  let app: INestApplication;
  const suffix = Date.now();
  let a: Awaited<ReturnType<typeof crearTenantConAdmin>>;
  let b: Awaited<ReturnType<typeof crearTenantConAdmin>>;
  let receptor: Server;
  let url = '';
  let recibidas: Recibida[] = [];
  let respuestas: number[] = [];

  const http = () => request(app.getHttpServer());
  const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

  async function esperarEntrega(token: string, webhookId: string, filtro: (e: Entrega) => boolean, ms = 8000) {
    const limite = Date.now() + ms;
    while (Date.now() < limite) {
      const e = ((await http().get(`/api/webhooks/${webhookId}/entregas`).set(auth(token))).body as Entrega[]).find(filtro);
      if (e) return e;
      await espera(100);
    }
    throw new Error('La entrega esperada no apareció a tiempo');
  }

  async function crearWebhook(token: string, eventos: string[], destino = url) {
    const r = await http().post('/api/webhooks').set(auth(token)).send({ url: destino, eventos });
    expect(r.status).toBe(201);
    return r.body as { id: string; secreto: string };
  }

  const limiteLoginOriginal = process.env.LOGIN_RATE_LIMIT;

  beforeAll(async () => {
    // Esta suite crea varias empresas (2 logins cada una): el límite anti fuerza bruta
    // se prueba aparte en rate-limit.e2e-spec.ts.
    process.env.LOGIN_RATE_LIMIT = '1000';
    receptor = createServer((req, res) => {
      let cuerpo = '';
      req.on('data', (c) => (cuerpo += c));
      req.on('end', () => {
        recibidas.push({ headers: req.headers, cuerpo, json: JSON.parse(cuerpo) });
        res.writeHead(respuestas.shift() ?? 200);
        res.end('ok');
      });
    });
    await new Promise<void>((ok) => receptor.listen(0, '127.0.0.1', ok));
    url = `http://127.0.0.1:${(receptor.address() as AddressInfo).port}/hook`;
    app = await createTestApp();
    a = await crearTenantConAdmin(app, `ApiA${suffix}`);
    b = await crearTenantConAdmin(app, `ApiB${suffix}`);
  });

  afterAll(async () => {
    process.env.LOGIN_RATE_LIMIT = limiteLoginOriginal;
    await app.close();
    await new Promise((r) => receptor.close(r));
  });

  beforeEach(() => {
    recibidas = [];
    respuestas = [];
  });

  // ------------------------------------------------------------------ webhooks
  describe('webhooks', () => {
    it('al crear devuelve el secreto una sola vez; no se lista y en la base está cifrado', async () => {
      const w = await crearWebhook(a.token, ['envio.creado']);
      expect(w.secreto).toMatch(/^whsec_/);

      const lista = await http().get('/api/webhooks').set(auth(a.token));
      expect(JSON.stringify(lista.body)).not.toContain(w.secreto);
      expect(JSON.stringify(lista.body)).not.toContain('secretCifrado');

      const fila = await app.get(PrismaService).webhookEndpoint.findUnique({ where: { id: w.id } });
      expect(fila!.secretCifrado).not.toContain(w.secreto);
      expect(fila!.secretCifrado.startsWith('v1:')).toBe(true);
      await http().delete(`/api/webhooks/${w.id}`).set(auth(a.token));
    });

    it('un envío nuevo dispara envio.creado con firma verificable', async () => {
      const w = await crearWebhook(a.token, ['envio.creado']);
      const envio = await http().post('/api/shipments').set(auth(a.token)).send(ENVIO_BASE);
      expect(envio.status).toBe(201);
      await esperarEntrega(a.token, w.id, (e) => e.evento === 'envio.creado' && e.estado === 'entregado');

      expect(recibidas).toHaveLength(1);
      const r = recibidas[0];
      expect(r.json.evento).toBe('envio.creado');
      expect(r.json.datos).toMatchObject({ codigoGuia: envio.body.codigoGuia, estado: 'creado' });
      expect(r.headers['x-sutl-event']).toBe('envio.creado');
      expect(r.headers['x-sutl-delivery']).toBe(r.json.id);
      // La firma se verifica con el secreto que recibió el integrador.
      expect(verificarFirma(w.secreto, r.headers['x-sutl-signature'] as string, r.cuerpo)).toBe(true);
      // Y no con otro secreto, ni con el cuerpo alterado, ni vencida.
      expect(verificarFirma('whsec_otro', r.headers['x-sutl-signature'] as string, r.cuerpo)).toBe(false);
      expect(verificarFirma(w.secreto, r.headers['x-sutl-signature'] as string, r.cuerpo + ' ')).toBe(false);
      expect(verificarFirma(w.secreto, r.headers['x-sutl-signature'] as string, r.cuerpo, 300, Date.now() + 600_000)).toBe(false);
      // El payload no filtra datos internos.
      expect(r.cuerpo).not.toContain(a.tenantId);
      await http().delete(`/api/webhooks/${w.id}`).set(auth(a.token));
    });

    it('cambiar el estado de un envío dispara envio.estado_cambiado; editar otra cosa, no', async () => {
      const w = await crearWebhook(a.token, ['envio.estado_cambiado']);
      const envio = await http().post('/api/shipments').set(auth(a.token)).send(ENVIO_BASE);
      await http().patch(`/api/shipments/${envio.body.id}`).set(auth(a.token)).send({ destino: 'Otro destino' });
      await http().patch(`/api/shipments/${envio.body.id}`).set(auth(a.token)).send({ estado: 'en_transito' });
      await esperarEntrega(a.token, w.id, (e) => e.estado === 'entregado');
      await espera(300);
      expect(recibidas).toHaveLength(1);
      expect(recibidas[0].json.datos).toMatchObject({ codigoGuia: envio.body.codigoGuia, estadoAnterior: 'creado', estadoNuevo: 'en_transito' });
      await http().delete(`/api/webhooks/${w.id}`).set(auth(a.token));
    });

    it('una OC que cambia de estado dispara orden_compra.estado_cambiado', async () => {
      const w = await crearWebhook(a.token, ['orden_compra.estado_cambiado']);
      const prov = (await http().post('/api/partners').set(auth(a.token)).send({ tipo: 'proveedor', nombre: `Prov ${suffix}` })).body.id;
      const oc = await http().post('/api/purchase-orders').set(auth(a.token)).send({
        numero: `WH-${suffix}`, proveedorId: prov, lineas: [{ sku: 'X-1', descripcion: 'x', cantidad: 10, unidad: 'u' }],
      });
      await http().post(`/api/purchase-orders/${oc.body.id}/transicion`).set(auth(a.token)).send({ estado: 'emitida' });
      await esperarEntrega(a.token, w.id, (e) => e.estado === 'entregado');
      expect(recibidas[0].json.datos).toMatchObject({ numero: `WH-${suffix}`, estadoAnterior: 'borrador', estadoNuevo: 'emitida' });
      await http().delete(`/api/webhooks/${w.id}`).set(auth(a.token));
    });

    it('solo recibe los eventos a los que está suscrito y deja de recibir al desactivarse', async () => {
      const w = await crearWebhook(a.token, ['envio.estado_cambiado']);
      await http().post('/api/shipments').set(auth(a.token)).send(ENVIO_BASE); // envio.creado: no suscrito
      await espera(400);
      expect(recibidas).toHaveLength(0);

      await http().patch(`/api/webhooks/${w.id}`).set(auth(a.token)).send({ activo: false });
      const envio = await http().post('/api/shipments').set(auth(a.token)).send(ENVIO_BASE);
      await http().patch(`/api/shipments/${envio.body.id}`).set(auth(a.token)).send({ estado: 'en_transito' });
      await espera(400);
      expect(recibidas).toHaveLength(0);
      await http().delete(`/api/webhooks/${w.id}`).set(auth(a.token));
    });

    it('un fallo del receptor se reintenta hasta lograrlo', async () => {
      const w = await crearWebhook(a.token, ['envio.creado']);
      respuestas = [500, 503];
      await http().post('/api/shipments').set(auth(a.token)).send(ENVIO_BASE);
      const e = await esperarEntrega(a.token, w.id, (x) => x.estado === 'entregado');
      expect(e.intentos).toBe(3);
      expect(recibidas).toHaveLength(3);
      await http().delete(`/api/webhooks/${w.id}`).set(auth(a.token));
    });

    it('si el receptor nunca responde bien queda fallida tras 5 intentos, con el motivo', async () => {
      const w = await crearWebhook(a.token, ['envio.creado']);
      respuestas = [500, 500, 500, 500, 500];
      await http().post('/api/shipments').set(auth(a.token)).send(ENVIO_BASE);
      const e = await esperarEntrega(a.token, w.id, (x) => x.estado === 'fallido');
      expect(e.intentos).toBe(5);
      expect(e.ultimoStatus).toBe(500);
      expect(e.error).toMatch(/500/);
      await http().delete(`/api/webhooks/${w.id}`).set(auth(a.token));
    });

    it('un receptor que redirige no se sigue (podría llevar a la red interna)', async () => {
      const w = await crearWebhook(a.token, ['envio.creado']);
      respuestas = [302, 302, 302, 302, 302];
      await http().post('/api/shipments').set(auth(a.token)).send(ENVIO_BASE);
      const e = await esperarEntrega(a.token, w.id, (x) => x.estado === 'fallido');
      expect(e.ultimoStatus).toBe(302);
      expect(recibidas).toHaveLength(5); // solo el destino registrado, nunca un segundo salto
      await http().delete(`/api/webhooks/${w.id}`).set(auth(a.token));
    });

    it('"probar" envía una entrega de prueba firmada', async () => {
      const w = await crearWebhook(a.token, ['envio.creado']);
      const r = await http().post(`/api/webhooks/${w.id}/probar`).set(auth(a.token));
      expect(r.status).toBe(201);
      const e = await esperarEntrega(a.token, w.id, (x) => x.evento === 'webhook.prueba' && x.estado === 'entregado');
      expect(e.intentos).toBe(1);
      expect(verificarFirma(w.secreto, recibidas[0].headers['x-sutl-signature'] as string, recibidas[0].cuerpo)).toBe(true);
      await http().delete(`/api/webhooks/${w.id}`).set(auth(a.token));
    });

    describe('validación y seguridad', () => {
      const crear = (token: string, body: Record<string, unknown>) => http().post('/api/webhooks').set(auth(token)).send(body);

      it('rechaza eventos desconocidos, listas vacías o repetidas, y URLs inválidas', async () => {
        expect((await crear(a.token, { url, eventos: ['inventado'] })).status).toBe(400);
        expect((await crear(a.token, { url, eventos: [] })).status).toBe(400);
        expect((await crear(a.token, { url, eventos: ['envio.creado', 'envio.creado'] })).status).toBe(400);
        expect((await crear(a.token, { url: 'no es url', eventos: ['envio.creado'] })).status).toBe(400);
        expect((await crear(a.token, { url: 'file:///etc/passwd', eventos: ['envio.creado'] })).status).toBe(400);
        expect((await crear(a.token, { url: 'http://u:p@127.0.0.1/hook', eventos: ['envio.creado'] })).status).toBe(400);
      });

      it('SSRF: con las protecciones de producción, http y direcciones internas se rechazan', async () => {
        process.env.WEBHOOKS_ALLOW_PRIVATE = 'false';
        try {
          for (const destino of [url, 'https://127.0.0.1/hook', 'https://169.254.169.254/latest/meta-data/', 'https://10.0.0.5/hook', 'https://localhost/hook']) {
            expect((await crear(a.token, { url: destino, eventos: ['envio.creado'] })).status).toBe(400);
          }
        } finally {
          process.env.WEBHOOKS_ALLOW_PRIVATE = 'true';
        }
      });

      it('si la URL deja de ser segura después de registrada, la entrega falla sin llamar al destino', async () => {
        const w = await crearWebhook(a.token, ['envio.creado']);
        process.env.WEBHOOKS_ALLOW_PRIVATE = 'false';
        try {
          await http().post('/api/shipments').set(auth(a.token)).send(ENVIO_BASE);
          const e = await esperarEntrega(a.token, w.id, (x) => x.estado === 'fallido');
          expect(e.error).toMatch(/https|interna/);
          expect(recibidas).toHaveLength(0);
        } finally {
          process.env.WEBHOOKS_ALLOW_PRIVATE = 'true';
        }
        await http().delete(`/api/webhooks/${w.id}`).set(auth(a.token));
      });

      it('límite de 10 webhooks por empresa', async () => {
        const c = await crearTenantConAdmin(app, `ApiC${suffix}`);
        for (let i = 0; i < 10; i++) await crearWebhook(c.token, ['envio.creado']);
        expect((await crear(c.token, { url, eventos: ['envio.creado'] })).status).toBe(400);
      });

      it('un operador no puede gestionar webhooks ni claves (403)', async () => {
        const sa = await superAdminToken(app);
        const email = `operador-${suffix}@e2e-test.com`;
        await http().post('/api/auth/register').set(auth(sa)).send({ tenantId: a.tenantId, email, password: PASSWORD, nombre: 'Operador' });
        const op = await loginAs(app, email);
        expect((await http().get('/api/webhooks').set(auth(op))).status).toBe(403);
        expect((await http().post('/api/webhooks').set(auth(op)).send({ url, eventos: ['envio.creado'] })).status).toBe(403);
        expect((await http().get('/api/api-keys').set(auth(op))).status).toBe(403);
        expect((await http().post('/api/api-keys').set(auth(op)).send({ nombre: 'x' })).status).toBe(403);
      });
    });

    describe('aislamiento entre empresas', () => {
      it('B no ve, edita, borra, prueba ni lee las entregas del webhook de A', async () => {
        const w = await crearWebhook(a.token, ['envio.creado']);
        expect(((await http().get('/api/webhooks').set(auth(b.token))).body as { id: string }[]).some((x) => x.id === w.id)).toBe(false);
        expect((await http().patch(`/api/webhooks/${w.id}`).set(auth(b.token)).send({ activo: false })).status).toBe(404);
        expect((await http().delete(`/api/webhooks/${w.id}`).set(auth(b.token))).status).toBe(404);
        expect((await http().post(`/api/webhooks/${w.id}/probar`).set(auth(b.token))).status).toBe(404);
        expect((await http().get(`/api/webhooks/${w.id}/entregas`).set(auth(b.token))).status).toBe(404);
        // Sigue intacto para A.
        expect(((await http().get('/api/webhooks').set(auth(a.token))).body as { id: string; activo: boolean }[]).find((x) => x.id === w.id)!.activo).toBe(true);
        await http().delete(`/api/webhooks/${w.id}`).set(auth(a.token));
      });

      it('los eventos de B no llegan al webhook de A', async () => {
        const w = await crearWebhook(a.token, ['envio.creado']);
        await http().post('/api/shipments').set(auth(b.token)).send(ENVIO_BASE);
        await espera(500);
        expect(recibidas).toHaveLength(0);
        await http().delete(`/api/webhooks/${w.id}`).set(auth(a.token));
      });
    });
  });

  // ------------------------------------------------------------------ API keys
  describe('API keys y API pública v1', () => {
    let llaveA: string;
    let llaveAId: string;
    let llaveB: string;
    let codigoA: string;
    let codigoB: string;

    beforeAll(async () => {
      const ka = await http().post('/api/api-keys').set(auth(a.token)).send({ nombre: 'ERP de A' });
      expect(ka.status).toBe(201);
      llaveA = ka.body.llave;
      llaveAId = ka.body.id;
      llaveB = (await http().post('/api/api-keys').set(auth(b.token)).send({ nombre: 'ERP de B' })).body.llave;
      codigoA = (await http().post('/api/shipments').set(auth(a.token)).send({ ...ENVIO_BASE, remitenteNombre: 'Solo de A' })).body.codigoGuia;
      codigoB = (await http().post('/api/shipments').set(auth(b.token)).send({ ...ENVIO_BASE, remitenteNombre: 'Solo de B' })).body.codigoGuia;
    });

    const v1 = (llave: string | undefined, ruta: string) => {
      const r = http().get(`/api/v1/${ruta}`);
      return llave ? r.set('X-API-Key', llave) : r;
    };

    it('la llave se muestra completa una sola vez y en la base solo queda su huella', async () => {
      expect(llaveA).toMatch(/^sutl_[A-Za-z0-9_-]{32}$/);
      const lista = await http().get('/api/api-keys').set(auth(a.token));
      expect(JSON.stringify(lista.body)).not.toContain(llaveA);
      expect(lista.body[0]).not.toHaveProperty('hash');
      expect(lista.body[0].prefijo).toBe(llaveA.slice(0, 11));
      const fila = await app.get(PrismaService).apiKey.findUnique({ where: { id: llaveAId } });
      expect(fila!.hash).not.toBe(llaveA);
      expect(JSON.stringify(fila)).not.toContain(llaveA);
    });

    it('con la llave de A se ven los envíos de A y solo los de A', async () => {
      const r = await v1(llaveA, 'shipments');
      expect(r.status).toBe(200);
      const guias = (r.body.datos as { codigoGuia: string }[]).map((e) => e.codigoGuia);
      expect(guias).toContain(codigoA);
      expect(guias).not.toContain(codigoB);
      expect(r.body).toMatchObject({ limite: 50, desde: 0 });
      // No expone campos internos.
      expect(JSON.stringify(r.body)).not.toContain(a.tenantId);
      expect(r.body.datos[0]).not.toHaveProperty('tenantId');
      expect(r.body.datos[0]).not.toHaveProperty('id');
    });

    it('con la llave de B no se ve el envío de A (404, no 403) y viceversa', async () => {
      expect((await v1(llaveB, `shipments/${codigoA}`)).status).toBe(404);
      expect((await v1(llaveA, `shipments/${codigoB}`)).status).toBe(404);
      const propio = await v1(llaveA, `shipments/${codigoA}`);
      expect(propio.status).toBe(200);
      expect(propio.body.codigoGuia).toBe(codigoA);
      expect(Array.isArray(propio.body.eventos)).toBe(true);
    });

    it('órdenes de compra y riesgo de abastecimiento, de la empresa de la llave', async () => {
      expect((await v1(llaveA, 'purchase-orders')).status).toBe(200);
      const r = await v1(llaveB, 'supply-risk');
      expect(r.status).toBe(200);
      expect(r.body.filas).toEqual([]); // B no tiene SKUs: no ve los de A
    });

    it('pagina y rechaza límites fuera de rango', async () => {
      expect((await v1(llaveA, 'shipments?limite=1')).body.datos).toHaveLength(1);
      expect((await v1(llaveA, 'shipments?limite=201')).status).toBe(400);
      expect((await v1(llaveA, 'shipments?limite=0')).status).toBe(400);
      expect((await v1(llaveA, 'shipments?desde=-1')).status).toBe(400);
      expect((await v1(llaveA, 'shipments?estado=inventado')).status).toBe(400);
    });

    it('sin llave, con formato inválido, inventada o con un JWT: 401 con el mismo mensaje', async () => {
      const respuestas = await Promise.all([
        v1(undefined, 'shipments'),
        v1('basura', 'shipments'),
        v1(`sutl_${'x'.repeat(32)}`, 'shipments'),
        http().get('/api/v1/shipments').set('X-API-Key', a.token),
        http().get('/api/v1/shipments').set(auth(a.token)),
      ]);
      for (const r of respuestas) {
        expect(r.status).toBe(401);
        expect(r.body.message).toBe('API key inválida');
      }
    });

    it('la llave NO sirve en la API interna del panel', async () => {
      expect((await http().get('/api/shipments').set('X-API-Key', llaveA)).status).toBe(401);
      expect((await http().get('/api/api-keys').set('X-API-Key', llaveA)).status).toBe(401);
    });

    it('registra el último uso', async () => {
      await v1(llaveA, 'shipments');
      await espera(300);
      const k = (await http().get('/api/api-keys').set(auth(a.token))).body.find((x: { id: string }) => x.id === llaveAId);
      expect(k.ultimoUsoAt).toBeTruthy();
    });

    it('B no puede revocar la llave de A (404) y A sí; revocada deja de funcionar', async () => {
      expect((await http().delete(`/api/api-keys/${llaveAId}`).set(auth(b.token))).status).toBe(404);
      expect((await v1(llaveA, 'shipments')).status).toBe(200);
      expect((await http().delete(`/api/api-keys/${llaveAId}`).set(auth(a.token))).status).toBe(200);
      const r = await v1(llaveA, 'shipments');
      expect(r.status).toBe(401);
      expect(r.body.message).toBe('API key inválida');
      expect((await http().delete(`/api/api-keys/${llaveAId}`).set(auth(a.token))).status).toBe(404); // ya revocada
    });

    it('una empresa desactivada pierde el acceso con todas sus llaves', async () => {
      const c = await crearTenantConAdmin(app, `ApiD${suffix}`);
      const llave = (await http().post('/api/api-keys').set(auth(c.token)).send({ nombre: 'x' })).body.llave;
      expect((await v1(llave, 'shipments')).status).toBe(200);
      await app.get(PrismaService).tenant.update({ where: { id: c.tenantId }, data: { activo: false } });
      expect((await v1(llave, 'shipments')).status).toBe(401);
    });

    it('valida el nombre y limita a 20 claves activas', async () => {
      const c = await crearTenantConAdmin(app, `ApiE${suffix}`);
      const crear = (nombre: unknown) => http().post('/api/api-keys').set(auth(c.token)).send({ nombre });
      expect((await crear('')).status).toBe(400);
      expect((await crear('x'.repeat(81))).status).toBe(400);
      for (let i = 0; i < 20; i++) expect((await crear(`k${i}`)).status).toBe(201);
      expect((await crear('una más')).status).toBe(400);
    });
  });
});
