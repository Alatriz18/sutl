import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './test-app';
import { auth, crearTenantConAdmin, loginAs, PASSWORD } from './test-helpers';

const DIA = 86_400_000;

// El proveedor registra el despacho real de SU orden: se crea el embarque con su guía, se asigna la carga con
// las reglas de cantidades de la empresa y la orden queda «despachada» con la fecha real. Nada cruza empresas.
describe('Despacho registrado por el proveedor (e2e)', () => {
  let app: INestApplication;
  const suffix = Date.now();
  const limiteLoginOriginal = process.env.LOGIN_RATE_LIMIT;
  const limiteDespachoOriginal = process.env.DESPACHO_RATE_LIMIT;
  let a: Awaited<ReturnType<typeof crearTenantConAdmin>>;
  let b: Awaited<ReturnType<typeof crearTenantConAdmin>>;
  let tokenProv: string;
  let tokenOtroProv: string;
  let tokenProvB: string;
  let partnerId: string;
  const http = () => request(app.getHttpServer());
  const prisma = () => app.get(PrismaService);
  const hace = (dias: number) => new Date(Date.now() - dias * DIA).toISOString();
  const despachar = (token: string, ocId: string, cuerpo: Record<string, unknown>) => http().post(`/api/portal/ordenes/${ocId}/despachar`).set(auth(token)).send(cuerpo);
  const base = (lineaId: string, cantidad = 4) => ({ modo: 'maritimo', origen: 'Shanghai', destino: 'Guayaquil', fechaDespacho: hace(1), lineas: [{ lineaId, cantidad }] });

  // OC de 10 unidades, ya emitida y (opcionalmente) confirmada.
  async function crearOc(token: string, proveedorId: string, numero: string, estado: 'emitida' | 'confirmada' | 'borrador') {
    const oc = await http().post('/api/purchase-orders').set(auth(token)).send({ numero, proveedorId, lineas: [{ sku: `SKU-${numero}`, descripcion: 'Material', cantidad: 10, unidad: 'kg' }] });
    expect(oc.status).toBe(201);
    if (estado !== 'borrador') await prisma().purchaseOrder.update({ where: { id: oc.body.id }, data: { estado, ...(estado === 'confirmada' ? { fechaConfirmadaProveedor: new Date(Date.now() + 5 * DIA) } : {}) } });
    return { id: oc.body.id as string, lineaId: oc.body.lineas[0].id as string };
  }

  async function usuarioProveedor(tokenAdmin: string, partner: string, etiqueta: string) {
    const email = `${etiqueta}-${suffix}@despacho-test.com`;
    const r = await http().post('/api/users').set(auth(tokenAdmin)).send({ email, password: PASSWORD, nombre: etiqueta, rol: 'proveedor', partnerId: partner });
    expect(r.status).toBe(201);
    return loginAs(app, email);
  }

  beforeAll(async () => {
    process.env.LOGIN_RATE_LIMIT = '1000';
    process.env.DESPACHO_RATE_LIMIT = '1000';
    app = await createTestApp();
    a = await crearTenantConAdmin(app, `Despacho A ${suffix}`);
    b = await crearTenantConAdmin(app, `Despacho B ${suffix}`);
    const p1 = await http().post('/api/partners').set(auth(a.token)).send({ tipo: 'proveedor', nombre: `Prov Uno ${suffix}` });
    const p2 = await http().post('/api/partners').set(auth(a.token)).send({ tipo: 'proveedor', nombre: `Prov Dos ${suffix}` });
    const pb = await http().post('/api/partners').set(auth(b.token)).send({ tipo: 'proveedor', nombre: `Prov B ${suffix}` });
    partnerId = p1.body.id;
    tokenProv = await usuarioProveedor(a.token, p1.body.id, 'prov1');
    tokenOtroProv = await usuarioProveedor(a.token, p2.body.id, 'prov2');
    tokenProvB = await usuarioProveedor(b.token, pb.body.id, 'provb');
  });

  afterAll(async () => {
    process.env.LOGIN_RATE_LIMIT = limiteLoginOriginal;
    if (limiteDespachoOriginal === undefined) delete process.env.DESPACHO_RATE_LIMIT;
    else process.env.DESPACHO_RATE_LIMIT = limiteDespachoOriginal;
    await app.close();
  });

  it('exige sesión y solo el proveedor puede usarlo', async () => {
    const oc = await crearOc(a.token, partnerId, `OC-D0-${suffix}`, 'confirmada');
    expect((await http().post(`/api/portal/ordenes/${oc.id}/despachar`).send(base(oc.lineaId))).status).toBe(401);
    expect((await despachar(a.token, oc.id, base(oc.lineaId))).status).toBe(403);
  });

  it('crea el embarque, asigna la carga y deja la orden despachada con la fecha real', async () => {
    const oc = await crearOc(a.token, partnerId, `OC-D1-${suffix}`, 'confirmada');
    const fecha = hace(2);
    const r = await despachar(tokenProv, oc.id, { ...base(oc.lineaId, 6), fechaDespacho: fecha, referenciaDocumento: 'BL-778899', fechaEstimadaLlegada: new Date(Date.now() + 20 * DIA).toISOString() });
    expect(r.status).toBe(200);
    expect(r.body.estado).toBe('despachada');
    expect(new Date(r.body.fechaDespacho).getTime()).toBe(new Date(fecha).getTime());
    expect(r.body.lineas[0].embarques).toHaveLength(1);
    expect(r.body.lineas[0].embarques[0].cantidad).toBe(6);
    const codigoGuia = r.body.lineas[0].embarques[0].shipment.codigoGuia as string;

    // El embarque existe en la empresa con el proveedor como remitente y la empresa como destinataria.
    const envios = await http().get('/api/shipments').set(auth(a.token));
    const envio = (envios.body as { codigoGuia: string; remitenteNombre: string; destinatarioNombre: string; referenciaDocumento: string; origen: string }[]).find((e) => e.codigoGuia === codigoGuia);
    expect(envio).toMatchObject({ remitenteNombre: `Prov Uno ${suffix}`, destinatarioNombre: `Despacho A ${suffix}`, referenciaDocumento: 'BL-778899', origen: 'Shanghai' });
    // Y la empresa lo ve en su orden, con bitácora.
    const orden = await http().get(`/api/purchase-orders/${oc.id}`).set(auth(a.token));
    expect(orden.body.estado).toBe('despachada');
    const bitacora = await prisma().auditLog.findMany({ where: { tenantId: a.tenantId, accion: 'portal.orden_despachada', entidadId: oc.id } });
    expect(bitacora).toHaveLength(1);
  });

  it('permite despachar el resto en un segundo embarque, pero nunca más de lo pedido', async () => {
    const oc = await crearOc(a.token, partnerId, `OC-D2-${suffix}`, 'confirmada');
    expect((await despachar(tokenProv, oc.id, base(oc.lineaId, 6))).status).toBe(200);
    // Quedan 4: 5 se pasa.
    const exceso = await despachar(tokenProv, oc.id, base(oc.lineaId, 5));
    expect(exceso.status).toBe(400);
    expect(JSON.stringify(exceso.body)).toContain('excede');
    const resto = await despachar(tokenProv, oc.id, base(oc.lineaId, 4));
    expect(resto.status).toBe(200);
    expect(resto.body.lineas[0].embarques).toHaveLength(2);
  });

  it('un despacho rechazado no deja un embarque a medias', async () => {
    const oc = await crearOc(a.token, partnerId, `OC-D3-${suffix}`, 'confirmada');
    const antes = (await http().get('/api/shipments').set(auth(a.token))).body.length;
    expect((await despachar(tokenProv, oc.id, base(oc.lineaId, 999))).status).toBe(400);
    expect((await http().get('/api/shipments').set(auth(a.token))).body.length).toBe(antes);
    expect((await http().get(`/api/purchase-orders/${oc.id}`).set(auth(a.token))).body.estado).toBe('confirmada');
  });

  it('solo se despacha una orden confirmada', async () => {
    const emitida = await crearOc(a.token, partnerId, `OC-D4-${suffix}`, 'emitida');
    expect((await despachar(tokenProv, emitida.id, base(emitida.lineaId))).status).toBe(400);
    const borrador = await crearOc(a.token, partnerId, `OC-D5-${suffix}`, 'borrador');
    expect((await despachar(tokenProv, borrador.id, base(borrador.lineaId))).status).toBe(404);
  });

  it('valida la fecha, la carga y los datos', async () => {
    const oc = await crearOc(a.token, partnerId, `OC-D6-${suffix}`, 'confirmada');
    const prueba = (cambio: Record<string, unknown>) => despachar(tokenProv, oc.id, { ...base(oc.lineaId), ...cambio });
    expect((await prueba({ fechaDespacho: new Date(Date.now() + 5 * DIA).toISOString() })).status).toBe(400); // futuro
    expect((await prueba({ fechaDespacho: hace(90) })).status).toBe(400); // muy vieja
    expect((await prueba({ fechaEstimadaLlegada: hace(10) })).status).toBe(400); // llegada antes de salir
    expect((await prueba({ lineas: [] })).status).toBe(400);
    expect((await prueba({ lineas: [{ lineaId: oc.lineaId, cantidad: 0 }] })).status).toBe(400);
    expect((await prueba({ lineas: [{ lineaId: oc.lineaId, cantidad: -3 }] })).status).toBe(400);
    expect((await prueba({ lineas: [{ lineaId: '3f2b1c9e-0000-4000-8000-000000000000', cantidad: 1 }] })).status).toBe(400); // línea que no es de la orden
    expect((await prueba({ lineas: [{ lineaId: oc.lineaId, cantidad: 1 }, { lineaId: oc.lineaId, cantidad: 1 }] })).status).toBe(400); // repetida
    expect((await prueba({ modo: 'cohete' })).status).toBe(400);
    expect((await prueba({ origen: '' })).status).toBe(400);
    expect((await prueba({ tenantId: b.tenantId })).status).toBe(400); // campos que no existen se rechazan
  });

  it('lo ajeno responde 404: otro proveedor y otra empresa', async () => {
    const oc = await crearOc(a.token, partnerId, `OC-D7-${suffix}`, 'confirmada');
    expect((await despachar(tokenOtroProv, oc.id, base(oc.lineaId))).status).toBe(404);
    expect((await despachar(tokenProvB, oc.id, base(oc.lineaId))).status).toBe(404);
    expect((await http().get(`/api/purchase-orders/${oc.id}`).set(auth(a.token))).body.estado).toBe('confirmada');
  });

  it('respeta la regla de la empresa «vincular un embarque despacha la orden» sin perder la fecha real', async () => {
    const patch = await http().patch('/api/tenant-config').set(auth(a.token)).send({ configuracion: { compras: { vincularEmbarqueDespachaOc: true } } });
    expect(patch.status).toBe(200);
    const oc = await crearOc(a.token, partnerId, `OC-D8-${suffix}`, 'confirmada');
    const fecha = hace(3);
    const r = await despachar(tokenProv, oc.id, { ...base(oc.lineaId, 2), fechaDespacho: fecha });
    expect(r.status).toBe(200);
    expect(r.body.estado).toBe('despachada');
    expect(new Date(r.body.fechaDespacho).getTime()).toBe(new Date(fecha).getTime());
  });
});
