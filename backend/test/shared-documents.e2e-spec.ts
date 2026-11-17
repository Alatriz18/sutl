import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './test-app';
import { auth, crearTenantConAdmin, ENVIO_BASE, loginAs, PASSWORD } from './test-helpers';

// Documentos compartidos (C3b): por defecto un documento es interno; el equipo comparte con el cliente final y/o
// el proveedor, y estos pueden subir los suyos. Nadie ve lo ajeno ni cruza empresas.
describe('Documentos compartidos (e2e)', () => {
  let app: INestApplication;
  const suffix = Date.now();
  const limiteLoginOriginal = process.env.LOGIN_RATE_LIMIT;
  let a: Awaited<ReturnType<typeof crearTenantConAdmin>>;
  let b: Awaited<ReturnType<typeof crearTenantConAdmin>>;
  let tokenCliente: string;
  let tokenOtroCliente: string;
  let tokenProvA: string;
  let tokenProvB: string;
  let tokenProvAjeno: string; // proveedor sin órdenes en el envío
  let envioId: string;
  let guia: string;
  const emailCliente = `docs-cli-${suffix}@docs-test.com`;
  const http = () => request(app.getHttpServer());
  const prisma = () => app.get(PrismaService);
  const lista = (token: string, id = envioId) => http().get(`/api/documents/shipment/${id}`).set(auth(token));
  const PDF = Buffer.from('%PDF-1.4 contenido de prueba');

  async function subirEquipo(tipo = 'otro', nombre = 'equipo.pdf') {
    const r = await http().post('/api/documents').set(auth(a.token)).field('shipmentId', envioId).field('tipo', tipo).attach('file', PDF, nombre);
    expect(r.status).toBe(201);
    return r.body.id as string;
  }
  const compartir = (id: string, cuerpo: Record<string, boolean>, token = a.token) => http().patch(`/api/documents/${id}/compartir`).set(auth(token)).send(cuerpo);

  async function proveedorConOc(nombre: string, linkear: boolean) {
    const partner = await http().post('/api/partners').set(auth(a.token)).send({ tipo: 'proveedor', nombre });
    const email = `${nombre.replace(/\W/g, '').toLowerCase()}-${suffix}@docs-test.com`;
    expect((await http().post('/api/users').set(auth(a.token)).send({ email, password: PASSWORD, nombre, rol: 'proveedor', partnerId: partner.body.id })).status).toBe(201);
    const oc = await http().post('/api/purchase-orders').set(auth(a.token)).send({ numero: `OC-${nombre}-${suffix}`.slice(0, 40), proveedorId: partner.body.id, lineas: [{ sku: `S-${nombre}`, descripcion: 'Material', cantidad: 10, unidad: 'kg' }] });
    expect(oc.status).toBe(201);
    await prisma().purchaseOrder.update({ where: { id: oc.body.id }, data: { estado: 'confirmada', fechaConfirmadaProveedor: new Date() } });
    if (linkear) {
      const l = await http().post(`/api/purchase-orders/${oc.body.id}/embarques`).set(auth(a.token)).send({ shipmentId: envioId, lineas: [{ lineaId: oc.body.lineas[0].id, cantidad: 5 }] });
      expect(l.status).toBe(201);
    }
    return loginAs(app, email);
  }

  beforeAll(async () => {
    process.env.LOGIN_RATE_LIMIT = '1000';
    app = await createTestApp();
    a = await crearTenantConAdmin(app, `Docs A ${suffix}`);
    b = await crearTenantConAdmin(app, `Docs B ${suffix}`);
    for (const [email, nombre] of [[emailCliente, 'Cliente Docs'], [`docs-otro-${suffix}@docs-test.com`, 'Otro cliente']]) {
      expect((await http().post('/api/users').set(auth(a.token)).send({ email, password: PASSWORD, nombre, rol: 'cliente_final' })).status).toBe(201);
    }
    tokenCliente = await loginAs(app, emailCliente);
    tokenOtroCliente = await loginAs(app, `docs-otro-${suffix}@docs-test.com`);
    const envio = await http().post('/api/shipments').set(auth(a.token)).send({ ...ENVIO_BASE, destinatarioEmail: emailCliente });
    expect(envio.status).toBe(201);
    envioId = envio.body.id;
    guia = envio.body.codigoGuia;
    tokenProvA = await proveedorConOc('ProvA', true);
    tokenProvB = await proveedorConOc('ProvB', true);
    tokenProvAjeno = await proveedorConOc('ProvAjeno', false);
  });

  afterAll(async () => {
    process.env.LOGIN_RATE_LIMIT = limiteLoginOriginal;
    await app.close();
  });

  it('exige sesión', async () => {
    expect((await http().get(`/api/documents/shipment/${envioId}`)).status).toBe(401);
  });

  it('un documento nuevo es interno: ni el cliente ni el proveedor lo ven ni lo descargan', async () => {
    const id = await subirEquipo('otro', 'interno.pdf');
    for (const t of [tokenCliente, tokenProvA]) {
      expect((await lista(t)).body).toEqual([]);
      expect((await http().get(`/api/documents/${id}/download`).set(auth(t))).status).toBe(404);
    }
    const equipo = (await lista(a.token)).body;
    expect(equipo.find((d: { id: string }) => d.id === id)).toMatchObject({ visibleCliente: false, visibleProveedor: false });
  });

  it('el equipo comparte con el cliente: lo ve y lo descarga, sin ver con quién más ni quién lo subió', async () => {
    const id = await subirEquipo('factura', 'para-cliente.pdf');
    expect((await compartir(id, { visibleCliente: true })).status).toBe(200);
    const visto = (await lista(tokenCliente)).body.find((d: { id: string }) => d.id === id);
    expect(visto).toMatchObject({ nombreArchivo: 'para-cliente.pdf', origen: 'equipo' });
    expect(JSON.stringify(visto)).not.toMatch(/subidoPor|visibleProveedor|visibleCliente|urlArchivo|uploads/);
    const d = await http().get(`/api/documents/${id}/download`).set(auth(tokenCliente)).buffer(true);
    expect(d.status).toBe(200);
    // El proveedor no recibe lo que se compartió solo con el cliente.
    expect((await lista(tokenProvA)).body.some((x: { id: string }) => x.id === id)).toBe(false);
    expect((await http().get(`/api/documents/${id}/download`).set(auth(tokenProvA))).status).toBe(404);
    // Otro cliente de la misma empresa tampoco: el envío no es suyo.
    expect((await lista(tokenOtroCliente)).status).toBe(404);
    expect((await http().get(`/api/documents/${id}/download`).set(auth(tokenOtroCliente))).status).toBe(404);
  });

  it('compartir con proveedores llega a los que traen carga en el envío, no a otros', async () => {
    const id = await subirEquipo('packing_list', 'para-prov.pdf');
    expect((await compartir(id, { visibleProveedor: true })).status).toBe(200);
    for (const t of [tokenProvA, tokenProvB]) {
      expect((await lista(t)).body.some((x: { id: string }) => x.id === id)).toBe(true);
      expect((await http().get(`/api/documents/${id}/download`).set(auth(t))).status).toBe(200);
    }
    expect((await lista(tokenProvAjeno)).status).toBe(404);
    expect((await http().get(`/api/documents/${id}/download`).set(auth(tokenProvAjeno))).status).toBe(404);
    expect((await lista(tokenCliente)).body.some((x: { id: string }) => x.id === id)).toBe(false);
    // Dejar de compartir lo retira.
    expect((await compartir(id, { visibleProveedor: false })).status).toBe(200);
    expect((await lista(tokenProvA)).body.some((x: { id: string }) => x.id === id)).toBe(false);
  });

  it('el cliente sube un documento: queda pendiente, lo ve su lado y el equipo, no el proveedor', async () => {
    const r = await http().post(`/api/documents/shipment/${envioId}/externo`).set(auth(tokenCliente)).field('tipo', 'otro').attach('file', PDF, 'orden-cliente.pdf');
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ estado: 'pendiente', nombreArchivo: 'orden-cliente.pdf', origen: 'propio' });
    expect((await lista(tokenCliente)).body.some((x: { id: string }) => x.id === r.body.id)).toBe(true);
    expect((await lista(tokenProvA)).body.some((x: { id: string }) => x.id === r.body.id)).toBe(false);
    const equipo = (await lista(a.token)).body.find((x: { id: string }) => x.id === r.body.id);
    expect(equipo).toMatchObject({ visibleCliente: true, visibleProveedor: false });
    expect((await http().get(`/api/documents/${r.body.id}/download`).set(auth(a.token))).status).toBe(200);
    // Bitácora y aviso al administrador.
    const bit = await prisma().auditLog.findFirst({ where: { tenantId: a.tenantId, accion: 'documento.subido_externo', entidadId: r.body.id } });
    expect(bit).not.toBeNull();
    const aviso = await prisma().notification.findFirst({ where: { tenantId: a.tenantId, tipo: 'portal_documento', asunto: { contains: guia } } });
    expect(aviso).not.toBeNull();
  });

  it('el proveedor sube su factura: no la ve otro proveedor ni el cliente', async () => {
    const r = await http().post(`/api/documents/shipment/${envioId}/externo`).set(auth(tokenProvA)).field('tipo', 'factura').attach('file', PDF, 'factura-prov-a.pdf');
    expect(r.status).toBe(201);
    expect((await lista(tokenProvA)).body.some((x: { id: string }) => x.id === r.body.id)).toBe(true);
    expect((await lista(tokenProvB)).body.some((x: { id: string }) => x.id === r.body.id)).toBe(false);
    expect((await http().get(`/api/documents/${r.body.id}/download`).set(auth(tokenProvB))).status).toBe(404);
    expect((await lista(tokenCliente)).body.some((x: { id: string }) => x.id === r.body.id)).toBe(false);
    // Si el equipo la comparte con proveedores, el otro proveedor sigue sin verla (es de A), y A sí.
    await compartir(r.body.id, { visibleProveedor: true });
    expect((await lista(tokenProvB)).body.some((x: { id: string }) => x.id === r.body.id)).toBe(false);
  });

  it('cada externo solo sube los tipos que le corresponden y archivos permitidos', async () => {
    const sube = (token: string, tipo: string, nombre = 'x.pdf') => http().post(`/api/documents/shipment/${envioId}/externo`).set(auth(token)).field('tipo', tipo).attach('file', PDF, nombre);
    expect((await sube(tokenCliente, 'bl')).status).toBe(400);
    expect((await sube(tokenProvA, 'pedimento')).status).toBe(400);
    expect((await sube(tokenProvA, 'factura', 'virus.exe')).status).toBe(400);
    expect((await http().post(`/api/documents/shipment/${envioId}/externo`).set(auth(tokenCliente)).field('tipo', 'otro')).status).toBe(400); // sin archivo
    // No pueden subir a un envío que no es suyo.
    expect((await http().post(`/api/documents/shipment/${envioId}/externo`).set(auth(tokenOtroCliente)).field('tipo', 'otro').attach('file', PDF, 'x.pdf')).status).toBe(404);
    expect((await http().post(`/api/documents/shipment/${envioId}/externo`).set(auth(tokenProvAjeno)).field('tipo', 'factura').attach('file', PDF, 'x.pdf')).status).toBe(404);
    // El equipo no usa esta ruta.
    expect((await http().post(`/api/documents/shipment/${envioId}/externo`).set(auth(a.token)).field('tipo', 'otro').attach('file', PDF, 'x.pdf')).status).toBe(403);
  });

  it('los externos no comparten ni listan todo, y la ruta general sigue cerrada para ellos', async () => {
    const id = await subirEquipo('otro', 'cerrado.pdf');
    for (const t of [tokenCliente, tokenProvA]) {
      expect((await compartir(id, { visibleCliente: true, visibleProveedor: true }, t)).status).toBe(403);
      expect((await http().get('/api/documents').set(auth(t))).status).toBe(403);
      expect((await http().patch(`/api/documents/${id}/revision`).set(auth(t)).send({ estado: 'aprobado' })).status).toBe(403);
    }
  });

  it('nada cruza empresas', async () => {
    const id = await subirEquipo('otro', 'tenant.pdf');
    expect((await lista(b.token)).status).toBe(404);
    expect((await compartir(id, { visibleCliente: true }, b.token)).status).toBe(404);
    expect((await http().get(`/api/documents/${id}/download`).set(auth(b.token))).status).toBe(404);
  });

  it('compartir pide indicar algo y valida los datos', async () => {
    const id = await subirEquipo('otro', 'val.pdf');
    expect((await compartir(id, {})).status).toBe(400);
    expect((await http().patch(`/api/documents/${id}/compartir`).set(auth(a.token)).send({ visibleCliente: 'si' })).status).toBe(400);
    expect((await compartir(id, { visibleCliente: true })).status).toBe(200);
    const bit = await prisma().auditLog.findFirst({ where: { tenantId: a.tenantId, accion: 'documento.compartido', entidadId: id } });
    expect(bit).not.toBeNull();
  });
});
