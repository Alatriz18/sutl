import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './test-app';
import { auth, crearTenantConAdmin, ENVIO_BASE } from './test-helpers';

type Item = { tipo: string; estado: string; requerido: boolean; documento: { id: string } | null };

// Checklist de documentos (C1): lo exigido depende del envío y de la configuración
// de la empresa; subir, aprobar o rechazar cambia el estado; nada cruza empresas.
describe('Checklist de documentos (e2e)', () => {
  let app: INestApplication;
  const suffix = Date.now();
  const limiteLoginOriginal = process.env.LOGIN_RATE_LIMIT;
  let a: Awaited<ReturnType<typeof crearTenantConAdmin>>;
  let b: Awaited<ReturnType<typeof crearTenantConAdmin>>;
  let envioId: string;
  const http = () => request(app.getHttpServer());
  const prisma = () => app.get(PrismaService);
  const checklist = async (token: string, id = envioId) => http().get(`/api/documents/checklist/${id}`).set(auth(token));
  const subir = (token: string, tipo: string, extra: Record<string, string> = {}) =>
    http()
      .post('/api/documents')
      .set(auth(token))
      .field('shipmentId', envioId)
      .field('tipo', tipo)
      .field(extra as never)
      .attach('file', Buffer.from('%PDF-1.4 prueba'), 'doc.pdf');

  beforeAll(async () => {
    process.env.LOGIN_RATE_LIMIT = '1000';
    app = await createTestApp();
    a = await crearTenantConAdmin(app, `Docs A ${suffix}`);
    b = await crearTenantConAdmin(app, `Docs B ${suffix}`);
    const envio = await http()
      .post('/api/shipments')
      .set(auth(a.token))
      .send({ ...ENVIO_BASE, tipo: 'exportacion', fechaEstimadaLlegada: new Date(Date.now() + 2 * 86400000).toISOString() });
    expect(envio.status).toBe(201);
    envioId = envio.body.id;
  });

  afterAll(async () => {
    process.env.LOGIN_RATE_LIMIT = limiteLoginOriginal;
    await app.close();
  });

  it('exige sesión', async () => {
    expect((await http().get(`/api/documents/checklist/${envioId}`)).status).toBe(401);
  });

  it('un envío marítimo de exportación exige factura, lista de empaque y BL; todo falta al inicio', async () => {
    const r = await checklist(a.token);
    expect(r.status).toBe(200);
    expect((r.body.items as Item[]).map((i) => [i.tipo, i.estado])).toEqual([
      ['factura', 'faltante'],
      ['packing_list', 'faltante'],
      ['bl', 'faltante'],
    ]);
    expect(r.body.completo).toBe(false);
  });

  it('un documento subido queda pendiente; aprobarlo lo da por cumplido; rechazar exige motivo', async () => {
    const subido = await subir(a.token, 'factura');
    expect(subido.status).toBe(201);
    expect(subido.body.estado).toBe('pendiente');

    let r = await checklist(a.token);
    expect((r.body.items as Item[]).find((i) => i.tipo === 'factura')?.estado).toBe('pendiente');

    const sinMotivo = await http().patch(`/api/documents/${subido.body.id}/revision`).set(auth(a.token)).send({ estado: 'rechazado' });
    expect(sinMotivo.status).toBe(400);

    const aprobado = await http().patch(`/api/documents/${subido.body.id}/revision`).set(auth(a.token)).send({ estado: 'aprobado' });
    expect(aprobado.status).toBe(200);
    expect(aprobado.body).toMatchObject({ estado: 'aprobado', revisadoPorId: a.userId });
    r = await checklist(a.token);
    expect((r.body.items as Item[]).find((i) => i.tipo === 'factura')?.estado).toBe('aprobado');
  });

  it('subir una versión nueva reemplaza a la anterior y la vieja ya no se puede revisar', async () => {
    const v1 = (await checklist(a.token)).body.items.find((i: Item) => i.tipo === 'factura').documento.id as string;
    const v2 = await subir(a.token, 'factura');
    expect(v2.body.version).toBe(2);
    const vieja = await http().patch(`/api/documents/${v1}/revision`).set(auth(a.token)).send({ estado: 'aprobado' });
    expect(vieja.status).toBe(409);
    const r = await checklist(a.token);
    expect((r.body.items as Item[]).find((i) => i.tipo === 'factura')?.estado).toBe('pendiente');
  });

  it('un documento vencido deja de cumplir aunque esté aprobado', async () => {
    const d = await subir(a.token, 'packing_list', { fechaVencimiento: new Date(Date.now() - 86400000).toISOString() });
    expect(d.status).toBe(201);
    await http().patch(`/api/documents/${d.body.id}/revision`).set(auth(a.token)).send({ estado: 'aprobado' });
    const r = await checklist(a.token);
    expect((r.body.items as Item[]).find((i) => i.tipo === 'packing_list')?.estado).toBe('vencido');
  });

  it('la empresa puede apagar lo que no exige y el checklist lo respeta', async () => {
    const cfg = await http().patch('/api/tenant-config').set(auth(a.token)).send({ configuracion: { documentos: { exigirDocumentoTransporte: false } } });
    expect(cfg.status).toBe(200);
    const r = await checklist(a.token);
    expect((r.body.items as Item[]).map((i) => i.tipo)).toEqual(['factura', 'packing_list']);
  });

  it('el envío con documentos pendientes y llegada cercana abre una excepción', async () => {
    const r = await http().post('/api/exceptions/evaluar').set(auth(a.token));
    expect(r.status).toBe(201);
    const lista = await http().get('/api/exceptions?estado=abierta').set(auth(a.token));
    const caso = (lista.body as { tipo: string; clave: string; severidad: string }[]).find((c) => c.clave === envioId);
    expect(caso).toMatchObject({ tipo: 'documento_faltante', severidad: 'alta' });
  });

  it('otra empresa no ve ni revisa nada de esto', async () => {
    expect((await checklist(b.token)).status).toBe(404);
    const doc = await prisma().document.findFirst({ where: { shipmentId: envioId } });
    const r = await http().patch(`/api/documents/${doc?.id}/revision`).set(auth(b.token)).send({ estado: 'aprobado' });
    expect(r.status).toBe(404);
  });
});
