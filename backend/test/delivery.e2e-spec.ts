import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './test-app';
import { auth, crearTenantConAdmin, ENVIO_BASE, loginAs, PASSWORD } from './test-helpers';

// Prueba de entrega (C6): constancia con evidencia, el envío pasa a «entregado», y la carga
// que viajaba se recibe en la orden de compra. Nada cruza empresas ni clientes.
describe('Prueba de entrega (e2e)', () => {
  let app: INestApplication;
  const suffix = Date.now();
  const limiteLoginOriginal = process.env.LOGIN_RATE_LIMIT;
  let a: Awaited<ReturnType<typeof crearTenantConAdmin>>;
  let b: Awaited<ReturnType<typeof crearTenantConAdmin>>;
  let tokenCliente: string;
  let tokenOtroCliente: string;
  const emailCliente = `pod-cli-${suffix}@pod-test.com`;
  const http = () => request(app.getHttpServer());
  const prisma = () => app.get(PrismaService);
  const pod = (token: string, envioId: string) => http().get(`/api/shipments/${envioId}/pod`).set(auth(token));

  async function crearEnvio(token: string, destinatarioEmail?: string) {
    const r = await http().post('/api/shipments').set(auth(token)).send({ ...ENVIO_BASE, ...(destinatarioEmail ? { destinatarioEmail } : {}) });
    expect(r.status).toBe(201);
    return r.body.id as string;
  }

  // OC confirmada de 100 kg con 60 viajando en el envío indicado.
  async function ocConCarga(envioId: string, numero: string) {
    const prov = await http().post('/api/partners').set(auth(a.token)).send({ tipo: 'proveedor', nombre: `Prov ${numero}` });
    const oc = await http().post('/api/purchase-orders').set(auth(a.token)).send({ numero, proveedorId: prov.body.id, lineas: [{ sku: `SKU-${numero}`, descripcion: 'Material', cantidad: 100, unidad: 'kg' }] });
    expect(oc.status).toBe(201);
    await prisma().purchaseOrder.update({ where: { id: oc.body.id }, data: { estado: 'confirmada', fechaConfirmadaProveedor: new Date() } });
    const link = await http().post(`/api/purchase-orders/${oc.body.id}/embarques`).set(auth(a.token)).send({ shipmentId: envioId, lineas: [{ lineaId: oc.body.lineas[0].id, cantidad: 60 }] });
    expect(link.status).toBe(201);
    return { id: oc.body.id as string, lineaId: oc.body.lineas[0].id as string };
  }

  beforeAll(async () => {
    process.env.LOGIN_RATE_LIMIT = '1000';
    app = await createTestApp();
    a = await crearTenantConAdmin(app, `POD A ${suffix}`);
    b = await crearTenantConAdmin(app, `POD B ${suffix}`);
    for (const [email, nombre] of [[emailCliente, 'Cliente POD'], [`pod-otro-${suffix}@pod-test.com`, 'Otro cliente']]) {
      expect((await http().post('/api/users').set(auth(a.token)).send({ email, password: PASSWORD, nombre, rol: 'cliente_final' })).status).toBe(201);
    }
    tokenCliente = await loginAs(app, emailCliente);
    tokenOtroCliente = await loginAs(app, `pod-otro-${suffix}@pod-test.com`);
  });

  afterAll(async () => {
    process.env.LOGIN_RATE_LIMIT = limiteLoginOriginal;
    await app.close();
  });

  it('exige sesión', async () => {
    const id = await crearEnvio(a.token);
    expect((await http().get(`/api/shipments/${id}/pod`)).status).toBe(401);
    expect((await http().post(`/api/shipments/${id}/pod`).send({ receptorNombre: 'X' })).status).toBe(401);
  });

  it('sin prueba responde vacío; registrar exige el nombre de quien recibe', async () => {
    const id = await crearEnvio(a.token);
    const vacio = await pod(a.token, id);
    expect(vacio.status).toBe(200);
    expect(vacio.body).toEqual({});
    expect((await http().post(`/api/shipments/${id}/pod`).set(auth(a.token)).field('observaciones', 'sin nombre')).status).toBe(400);
    expect((await http().post(`/api/shipments/${id}/pod`).set(auth(a.token)).field('receptorNombre', 'Ana').field('entregadoAt', new Date(Date.now() + 10 * 86400000).toISOString())).status).toBe(400);
  });

  it('registra la prueba con evidencia: el envío queda entregado y la bitácora lo anota', async () => {
    const id = await crearEnvio(a.token, emailCliente);
    const r = await http()
      .post(`/api/shipments/${id}/pod`)
      .set(auth(a.token))
      .field('receptorNombre', 'Ana Pérez')
      .field('receptorDocumento', '1712345678')
      .field('observaciones', 'Recibido conforme')
      .attach('evidencia', Buffer.from('%PDF-1.4 firma'), 'firma.pdf');
    expect(r.status).toBe(201);
    expect(r.body.pod).toMatchObject({ receptorNombre: 'Ana Pérez', receptorDocumento: '1712345678', tieneArchivo: true });
    expect(JSON.stringify(r.body)).not.toContain('/uploads/');

    const envio = await http().get(`/api/shipments/${id}`).set(auth(a.token));
    expect(envio.body.estado).toBe('entregado');
    const eventos = await http().get(`/api/tracking-events/shipment/${id}`).set(auth(a.token));
    expect((eventos.body as { estado: string; descripcion: string }[]).some((e) => e.estado === 'entregado' && e.descripcion.includes('Ana Pérez'))).toBe(true);

    const bitacora = await http().get('/api/audit?limite=100').set(auth(a.token));
    expect((bitacora.body as { accion: string }[]).map((x) => x.accion)).toContain('pod.registrado');

    const descarga = await http().get(`/api/shipments/${id}/pod/evidencia`).set(auth(a.token));
    expect(descarga.status).toBe(200);
    expect(descarga.body.toString()).toContain('%PDF-1.4 firma');
  });

  it('una segunda prueba para el mismo envío da 409', async () => {
    const id = await crearEnvio(a.token);
    expect((await http().post(`/api/shipments/${id}/pod`).set(auth(a.token)).field('receptorNombre', 'Ana')).status).toBe(201);
    expect((await http().post(`/api/shipments/${id}/pod`).set(auth(a.token)).field('receptorNombre', 'Otra persona')).status).toBe(409);
  });

  it('rechaza evidencia que no sea foto o PDF', async () => {
    const id = await crearEnvio(a.token);
    const r = await http().post(`/api/shipments/${id}/pod`).set(auth(a.token)).field('receptorNombre', 'Ana').attach('evidencia', Buffer.from('MZ...'), 'virus.exe');
    expect(r.status).toBe(400);
    expect((await pod(a.token, id)).body).toEqual({});
  });

  it('recibir la OC: entra lo que viajaba en el envío y la OC queda parcialmente recibida', async () => {
    const id = await crearEnvio(a.token);
    const oc = await ocConCarga(id, `OC-POD-${suffix}`);
    const r = await http().post(`/api/shipments/${id}/pod`).set(auth(a.token)).field('receptorNombre', 'Bodega').field('recibirOc', 'true');
    expect(r.status).toBe(201);
    expect(r.body.recepciones).toEqual([{ numero: `OC-POD-${suffix}`, ok: true }]);
    const interno = await http().get(`/api/purchase-orders/${oc.id}`).set(auth(a.token));
    expect(interno.body.estado).toBe('recibida_parcial');
    expect(interno.body.lineas[0].cantidadRecibida).toBe(60);
  });

  it('si la OC no se puede recibir, la prueba igual queda registrada y se informa por OC', async () => {
    const id = await crearEnvio(a.token);
    const oc = await ocConCarga(id, `OC-POD2-${suffix}`);
    await prisma().purchaseOrder.update({ where: { id: oc.id }, data: { estado: 'emitida' } }); // aún no confirmada: no admite recepción
    const r = await http().post(`/api/shipments/${id}/pod`).set(auth(a.token)).field('receptorNombre', 'Bodega').field('recibirOc', 'true');
    expect(r.status).toBe(201);
    expect(r.body.recepciones).toHaveLength(1);
    expect(r.body.recepciones[0]).toMatchObject({ ok: false });
    expect((await pod(a.token, id)).body.receptorNombre).toBe('Bodega');
  });

  it('el cliente final ve la prueba de SU envío (con evidencia) y no la de otro', async () => {
    const propio = await crearEnvio(a.token, emailCliente);
    await http().post(`/api/shipments/${propio}/pod`).set(auth(a.token)).field('receptorNombre', 'Cliente POD').attach('evidencia', Buffer.from('%PDF-1.4'), 'e.pdf');
    expect((await pod(tokenCliente, propio)).body).toMatchObject({ receptorNombre: 'Cliente POD', tieneArchivo: true });
    expect((await http().get(`/api/shipments/${propio}/pod/evidencia`).set(auth(tokenCliente))).status).toBe(200);

    expect((await pod(tokenOtroCliente, propio)).status).toBe(404);
    expect((await http().get(`/api/shipments/${propio}/pod/evidencia`).set(auth(tokenOtroCliente))).status).toBe(404);
  });

  it('el cliente final no puede registrar pruebas de entrega', async () => {
    const propio = await crearEnvio(a.token, emailCliente);
    expect((await http().post(`/api/shipments/${propio}/pod`).set(auth(tokenCliente)).field('receptorNombre', 'Yo mismo')).status).toBe(403);
  });

  it('otra empresa no ve ni registra nada de esto', async () => {
    const id = await crearEnvio(a.token);
    await http().post(`/api/shipments/${id}/pod`).set(auth(a.token)).field('receptorNombre', 'Ana');
    expect((await pod(b.token, id)).status).toBe(404);
    expect((await http().post(`/api/shipments/${id}/pod`).set(auth(b.token)).field('receptorNombre', 'Intruso')).status).toBe(404);
    expect((await http().get(`/api/shipments/${id}/pod/evidencia`).set(auth(b.token))).status).toBe(404);
  });
});
