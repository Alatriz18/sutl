import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './test-app';
import { auth, crearTenantConAdmin, ENVIO_BASE, loginAs, PASSWORD } from './test-helpers';

type Mensaje = { id: string; texto: string; delEquipo: boolean };

// Portal colaborativo (C3): el proveedor conversa y confirma sus órdenes; el cliente final
// ve solo SUS envíos y conversa sobre ellos. Nada cruza empresas ni se filtran datos internos.
describe('Portal colaborativo (e2e)', () => {
  let app: INestApplication;
  const suffix = Date.now();
  const limiteLoginOriginal = process.env.LOGIN_RATE_LIMIT;
  let a: Awaited<ReturnType<typeof crearTenantConAdmin>>;
  let b: Awaited<ReturnType<typeof crearTenantConAdmin>>;
  let tokenProveedor: string;
  let tokenCliente: string;
  let ocPropia: string;
  let ocAjena: string;
  let envioPropio: string;
  let envioAjeno: string;
  const emailCliente = `cliente-${suffix}@portal-test.com`;
  const http = () => request(app.getHttpServer());
  const prisma = () => app.get(PrismaService);
  const mensajes = async (token: string, tipo: string, id: string) => http().get(`/api/portal/mensajes?entidadTipo=${tipo}&entidadId=${id}`).set(auth(token));
  const publicar = (token: string, entidadTipo: string, entidadId: string, texto: string) =>
    http().post('/api/portal/mensajes').set(auth(token)).send({ entidadTipo, entidadId, texto });
  const manana = () => new Date(Date.now() + 2 * 86400000).toISOString();

  async function crearOc(proveedorId: string, numero: string) {
    const oc = await http()
      .post('/api/purchase-orders')
      .set(auth(a.token))
      .send({ numero, proveedorId, lineas: [{ sku: `SKU-${numero}`, descripcion: 'Material', cantidad: 10, unidad: 'kg' }] });
    expect(oc.status).toBe(201);
    await prisma().purchaseOrder.update({ where: { id: oc.body.id }, data: { estado: 'emitida' } });
    return oc.body.id as string;
  }

  beforeAll(async () => {
    process.env.LOGIN_RATE_LIMIT = '1000';
    app = await createTestApp();
    a = await crearTenantConAdmin(app, `Portal A ${suffix}`);
    b = await crearTenantConAdmin(app, `Portal B ${suffix}`);

    const p1 = await http().post('/api/partners').set(auth(a.token)).send({ tipo: 'proveedor', nombre: `Prov 1 ${suffix}` });
    const p2 = await http().post('/api/partners').set(auth(a.token)).send({ tipo: 'proveedor', nombre: `Prov 2 ${suffix}` });
    ocPropia = await crearOc(p1.body.id, `OC-PT1-${suffix}`);
    ocAjena = await crearOc(p2.body.id, `OC-PT2-${suffix}`);

    const emailProv = `prov-${suffix}@portal-test.com`;
    const up = await http().post('/api/users').set(auth(a.token)).send({ email: emailProv, password: PASSWORD, nombre: 'Proveedor', rol: 'proveedor', partnerId: p1.body.id });
    expect(up.status).toBe(201);
    tokenProveedor = await loginAs(app, emailProv);

    const uc = await http().post('/api/users').set(auth(a.token)).send({ email: emailCliente, password: PASSWORD, nombre: 'Cliente final', rol: 'cliente_final' });
    expect(uc.status).toBe(201);
    tokenCliente = await loginAs(app, emailCliente);

    const s1 = await http().post('/api/shipments').set(auth(a.token)).send({ ...ENVIO_BASE, destinatarioEmail: emailCliente.toUpperCase() });
    const s2 = await http().post('/api/shipments').set(auth(a.token)).send({ ...ENVIO_BASE, destinatarioEmail: `otro-${suffix}@portal-test.com` });
    expect(s1.status).toBe(201);
    envioPropio = s1.body.id;
    envioAjeno = s2.body.id;
    await http().post('/api/tracking-events').set(auth(a.token)).send({ shipmentId: envioPropio, estado: 'en_transito', ubicacion: 'Puerto', descripcion: 'Zarpó' });
  });

  afterAll(async () => {
    process.env.LOGIN_RATE_LIMIT = limiteLoginOriginal;
    await app.close();
  });

  describe('cliente final: solo lo suyo y solo lectura', () => {
    it('lista únicamente sus envíos (el correo no distingue mayúsculas) y sin datos internos', async () => {
      const r = await http().get('/api/shipments').set(auth(tokenCliente));
      expect(r.status).toBe(200);
      const ids = (r.body as { id: string }[]).map((s) => s.id);
      expect(ids).toEqual([envioPropio]);
      expect(r.body[0]).not.toHaveProperty('bookingId');
      expect(r.body[0]).not.toHaveProperty('containerId');
      expect(r.body[0]).not.toHaveProperty('carrierId');
      expect(r.body[0]).not.toHaveProperty('tenantId');
    });

    it('ve el detalle de su envío; el de otro cliente responde 404', async () => {
      expect((await http().get(`/api/shipments/${envioPropio}`).set(auth(tokenCliente))).status).toBe(200);
      expect((await http().get(`/api/shipments/${envioAjeno}`).set(auth(tokenCliente))).status).toBe(404);
    });

    it('ve el seguimiento de su envío sin el responsable interno; el de otro, 404', async () => {
      const r = await http().get(`/api/tracking-events/shipment/${envioPropio}`).set(auth(tokenCliente));
      expect(r.status).toBe(200);
      expect(r.body.length).toBeGreaterThanOrEqual(1);
      expect(r.body[0]).not.toHaveProperty('responsable');
      expect((await http().get(`/api/tracking-events/shipment/${envioAjeno}`).set(auth(tokenCliente))).status).toBe(404);
    });

    it('no puede crear ni modificar envíos ni registrar eventos', async () => {
      expect((await http().post('/api/shipments').set(auth(tokenCliente)).send({ ...ENVIO_BASE })).status).toBe(403);
      expect((await http().patch(`/api/shipments/${envioPropio}`).set(auth(tokenCliente)).send({ estado: 'entregado' })).status).toBe(403);
      expect((await http().post('/api/tracking-events').set(auth(tokenCliente)).send({ shipmentId: envioPropio, estado: 'entregado' })).status).toBe(403);
    });

    it('todo lo demás le está vedado por defecto', async () => {
      for (const ruta of ['/api/documents', '/api/purchase-orders', '/api/users', '/api/tasks', '/api/control-tower', '/api/partners', '/api/carriers', '/api/quotes', '/api/invoices']) {
        const r = await http().get(ruta).set(auth(tokenCliente));
        expect([ruta, r.status]).toEqual([ruta, 403]);
      }
    });
  });

  describe('conversación', () => {
    it('exige sesión y validación', async () => {
      expect((await http().get(`/api/portal/mensajes?entidadTipo=envio&entidadId=${envioPropio}`)).status).toBe(401);
      expect((await publicar(tokenProveedor, 'otra_cosa', ocPropia, 'hola')).status).toBe(400);
      expect((await publicar(tokenProveedor, 'orden_compra', ocPropia, '   ')).status).toBe(400);
      expect((await publicar(tokenProveedor, 'orden_compra', ocPropia, 'x'.repeat(2001))).status).toBe(400);
    });

    it('el proveedor y el equipo conversan sobre una orden', async () => {
      const m1 = await publicar(tokenProveedor, 'orden_compra', ocPropia, '  Tenemos la mercadería lista  ');
      expect(m1.status).toBe(201);
      const m2 = await publicar(a.token, 'orden_compra', ocPropia, 'Perfecto, ¿cuándo despachan?');
      expect(m2.status).toBe(201);

      for (const token of [tokenProveedor, a.token]) {
        const r = await mensajes(token, 'orden_compra', ocPropia);
        expect(r.status).toBe(200);
        expect((r.body as Mensaje[]).map((m) => [m.texto, m.delEquipo])).toEqual([
          ['Tenemos la mercadería lista', false],
          ['Perfecto, ¿cuándo despachan?', true],
        ]);
        expect(JSON.stringify(r.body)).not.toContain('admin_tenant');
      }
    });

    it('el proveedor no ve ni escribe en órdenes ajenas ni en envíos; el cliente no entra a órdenes', async () => {
      expect((await mensajes(tokenProveedor, 'orden_compra', ocAjena)).status).toBe(404);
      expect((await publicar(tokenProveedor, 'orden_compra', ocAjena, 'hola')).status).toBe(404);
      expect((await mensajes(tokenProveedor, 'envio', envioPropio)).status).toBe(403);
      expect((await mensajes(tokenCliente, 'orden_compra', ocPropia)).status).toBe(403);
    });

    it('el cliente final conversa sobre su envío y no sobre el de otro', async () => {
      expect((await publicar(tokenCliente, 'envio', envioPropio, '¿Cuándo llega?')).status).toBe(201);
      expect((await publicar(a.token, 'envio', envioPropio, 'El jueves.')).status).toBe(201);
      const r = await mensajes(tokenCliente, 'envio', envioPropio);
      expect((r.body as Mensaje[]).map((m) => m.delEquipo)).toEqual([false, true]);
      expect((await mensajes(tokenCliente, 'envio', envioAjeno)).status).toBe(404);
      expect((await publicar(tokenCliente, 'envio', envioAjeno, 'hola')).status).toBe(404);
    });

    it('otra empresa no ve nada de esto', async () => {
      expect((await mensajes(b.token, 'orden_compra', ocPropia)).status).toBe(404);
      expect((await mensajes(b.token, 'envio', envioPropio)).status).toBe(404);
    });

    it('los mensajes quedan en la bitácora de la empresa', async () => {
      const r = await http().get('/api/audit?limite=200').set(auth(a.token));
      const acciones = (r.body as { accion: string }[]).map((x) => x.accion);
      expect(acciones).toContain('portal.mensaje');
    });
  });

  describe('el proveedor confirma una orden', () => {
    it('solo el proveedor puede confirmar desde el portal', async () => {
      expect((await http().post(`/api/portal/ordenes/${ocPropia}/confirmar`).set(auth(a.token)).send({ fechaConfirmada: manana() })).status).toBe(403);
      expect((await http().post(`/api/portal/ordenes/${ocPropia}/confirmar`).set(auth(tokenCliente)).send({ fechaConfirmada: manana() })).status).toBe(403);
    });

    it('una orden ajena responde 404 y una fecha pasada, 400', async () => {
      expect((await http().post(`/api/portal/ordenes/${ocAjena}/confirmar`).set(auth(tokenProveedor)).send({ fechaConfirmada: manana() })).status).toBe(404);
      const pasada = new Date(Date.now() - 10 * 86400000).toISOString();
      expect((await http().post(`/api/portal/ordenes/${ocPropia}/confirmar`).set(auth(tokenProveedor)).send({ fechaConfirmada: pasada })).status).toBe(400);
      expect((await http().post(`/api/portal/ordenes/${ocPropia}/confirmar`).set(auth(tokenProveedor)).send({ fechaConfirmada: 'no-es-fecha' })).status).toBe(400);
    });

    it('confirma con su fecha, la empresa la ve y no se puede confirmar dos veces', async () => {
      const fecha = manana();
      const r = await http().post(`/api/portal/ordenes/${ocPropia}/confirmar`).set(auth(tokenProveedor)).send({ fechaConfirmada: fecha });
      expect(r.status).toBe(200);
      expect(r.body.estado).toBe('confirmada');
      expect(new Date(r.body.fechaConfirmadaProveedor).toISOString()).toBe(new Date(fecha).toISOString());
      expect(r.body).not.toHaveProperty('notas');

      const interno = await http().get(`/api/purchase-orders/${ocPropia}`).set(auth(a.token));
      expect(interno.body.estado).toBe('confirmada');

      const otra = await http().post(`/api/portal/ordenes/${ocPropia}/confirmar`).set(auth(tokenProveedor)).send({ fechaConfirmada: fecha });
      expect(otra.status).toBe(400);
    });
  });
});
