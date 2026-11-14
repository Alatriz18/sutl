import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './test-app';
import { auth, crearTenantConAdmin, loginAs, PASSWORD } from './test-helpers';

const DIA = 86_400_000;

// Analítica: OTIF, lead time, aging y cumplimiento calculados sobre OC reales de la empresa.
describe('Analítica (e2e)', () => {
  let app: INestApplication;
  const suffix = Date.now();
  const limiteLoginOriginal = process.env.LOGIN_RATE_LIMIT;
  let a: Awaited<ReturnType<typeof crearTenantConAdmin>>;
  let b: Awaited<ReturnType<typeof crearTenantConAdmin>>;
  const http = () => request(app.getHttpServer());
  const prisma = () => app.get(PrismaService);
  const ago = (dias: number) => new Date(Date.now() - dias * DIA);

  // Crea una OC con una línea de 100 unidades y le fija estado, fechas y lo recibido.
  async function crearOc(proveedorId: string, numero: string, p: { estado: 'recibida' | 'recibida_parcial' | 'emitida'; emitida: number; requerida: number; recibido: number; recibidoHace?: number; confirmada?: number; despacho?: number }) {
    const oc = await http()
      .post('/api/purchase-orders')
      .set(auth(a.token))
      .send({ numero, proveedorId, lineas: [{ sku: `SKU-${numero}`, descripcion: 'Material', cantidad: 100, unidad: 'kg' }] });
    expect(oc.status).toBe(201);
    await prisma().purchaseOrder.update({
      where: { id: oc.body.id },
      data: {
        estado: p.estado,
        fechaEmision: ago(p.emitida),
        fechaRequerida: ago(p.requerida),
        fechaConfirmadaProveedor: p.confirmada !== undefined ? ago(p.confirmada) : null,
        fechaDespacho: p.despacho !== undefined ? ago(p.despacho) : null,
      },
    });
    const linea = await prisma().purchaseOrderLine.findFirstOrThrow({ where: { purchaseOrderId: oc.body.id } });
    await prisma().purchaseOrderLine.update({ where: { id: linea.id }, data: { cantidadRecibida: p.recibido } });
    if (p.recibido > 0) {
      await prisma().purchaseOrderReceipt.create({ data: { tenantId: a.tenantId, purchaseOrderLineId: linea.id, cantidad: p.recibido, fecha: ago(p.recibidoHace ?? 0) } });
    }
    return oc.body.id as string;
  }

  beforeAll(async () => {
    process.env.LOGIN_RATE_LIMIT = '1000';
    app = await createTestApp();
    a = await crearTenantConAdmin(app, `Analitica A ${suffix}`);
    b = await crearTenantConAdmin(app, `Analitica B ${suffix}`);
    const bueno = await http().post('/api/partners').set(auth(a.token)).send({ tipo: 'proveedor', nombre: `Bueno ${suffix}` });
    const malo = await http().post('/api/partners').set(auth(a.token)).send({ tipo: 'proveedor', nombre: `Malo ${suffix}` });

    // Bueno: vencía hace 20 días y se completó hace 25 (a tiempo); promesa cumplida.
    await crearOc(bueno.body.id, `OC-AN1-${suffix}`, { estado: 'recibida', emitida: 60, requerida: 20, recibido: 100, recibidoHace: 25, confirmada: 40, despacho: 41 });
    // Malo: vencía hace 20 días y se completó hace 10 (tarde, 10 días); promesa incumplida.
    await crearOc(malo.body.id, `OC-AN2-${suffix}`, { estado: 'recibida', emitida: 60, requerida: 20, recibido: 100, recibidoHace: 10, confirmada: 40, despacho: 35 });
    // Malo: vencía hace 15 días y sigue a medias (60 %).
    await crearOc(malo.body.id, `OC-AN3-${suffix}`, { estado: 'recibida_parcial', emitida: 50, requerida: 15, recibido: 60, recibidoHace: 12 });
    // Abierta y atrasada 40 días (para el aging); queda fuera del periodo por defecto de 30 días.
    await crearOc(malo.body.id, `OC-AN4-${suffix}`, { estado: 'emitida', emitida: 120, requerida: 40, recibido: 0 });
  });

  afterAll(async () => {
    process.env.LOGIN_RATE_LIMIT = limiteLoginOriginal;
    await app.close();
  });

  const resumen = (token: string, query = '') => http().get(`/api/analytics/resumen${query}`).set(auth(token));
  const desde = (dias: number) => ago(dias).toISOString();

  it('exige sesión', async () => {
    expect((await http().get('/api/analytics/resumen')).status).toBe(401);
  });

  it('calcula OTIF, a tiempo, completo y lead time del periodo', async () => {
    const r = await resumen(a.token, `?desde=${desde(30)}&hasta=${new Date().toISOString()}`);
    expect(r.status).toBe(200);
    // En los últimos 30 días vencían AN1, AN2 y AN3.
    expect(r.body.otif).toMatchObject({ ocsEvaluadas: 3, aTiempo: 1, completas: 2, otif: 1, pctOtif: 33.3, pctATiempo: 33.3, pctCompleto: 66.7 });
    expect(r.body.leadTime.muestra).toBe(2);
    // AN1: 60 → 25 = 35 días; AN2: 60 → 10 = 50 días.
    expect(r.body.leadTime.promedioDias).toBeCloseTo(42.5, 0);
  });

  it('ordena a los proveedores del peor al mejor', async () => {
    const r = await resumen(a.token, `?desde=${desde(30)}&hasta=${new Date().toISOString()}`);
    const nombres = (r.body.proveedores as { nombre: string; pctOtif: number }[]).map((p) => [p.nombre.split(' ')[0], p.pctOtif]);
    expect(nombres).toEqual([['Malo', 0], ['Bueno', 100]]);
  });

  it('mide la promesa del proveedor', async () => {
    const r = await resumen(a.token, `?desde=${desde(30)}&hasta=${new Date().toISOString()}`);
    expect(r.body.cumplimiento).toMatchObject({ ocs: 3, conPromesaEvaluada: 2, pctCumplePromesa: 50 });
    // Ninguna de las 3 tiene fecha comprometida salvo AN1 y AN2: 2 de 3 confirmadas.
    expect(r.body.cumplimiento.pctConfirmadas).toBe(66.7);
  });

  it('el aging cuenta las OC abiertas por días de atraso', async () => {
    const r = await resumen(a.token);
    expect(r.body.aging.totalAbiertas).toBe(2); // AN3 (parcial) y AN4 (emitida)
    const porClave = Object.fromEntries((r.body.aging.buckets as { clave: string; ocs: number }[]).map((x) => [x.clave, x.ocs]));
    expect(porClave.mas_30).toBe(1); // AN4: 40 días
    expect(porClave['8_15'] + porClave['16_30']).toBe(1); // AN3: 15 días
  });

  it('la tendencia trae los últimos 6 meses', async () => {
    const r = await resumen(a.token);
    expect(r.body.tendencia).toHaveLength(6);
  });

  it('valida el periodo', async () => {
    expect((await resumen(a.token, '?desde=no-es-fecha')).status).toBe(400);
    expect((await resumen(a.token, `?desde=${new Date().toISOString()}&hasta=${desde(10)}`)).status).toBe(400);
    expect((await resumen(a.token, `?desde=${desde(500)}&hasta=${new Date().toISOString()}`)).status).toBe(400);
  });

  it('otra empresa no ve nada de esto', async () => {
    const r = await resumen(b.token, `?desde=${desde(60)}&hasta=${new Date().toISOString()}`);
    expect(r.status).toBe(200);
    expect(r.body.otif.ocsEvaluadas).toBe(0);
    expect(r.body.proveedores).toEqual([]);
    expect(r.body.aging.totalAbiertas).toBe(0);
  });

  it('el proveedor y el cliente final no tienen acceso', async () => {
    const p = await http().post('/api/partners').set(auth(a.token)).send({ tipo: 'proveedor', nombre: `P ${suffix}` });
    const emailP = `an-prov-${suffix}@an-test.com`;
    await http().post('/api/users').set(auth(a.token)).send({ email: emailP, password: PASSWORD, nombre: 'Prov', rol: 'proveedor', partnerId: p.body.id });
    const emailC = `an-cli-${suffix}@an-test.com`;
    await http().post('/api/users').set(auth(a.token)).send({ email: emailC, password: PASSWORD, nombre: 'Cli', rol: 'cliente_final' });
    expect((await resumen(await loginAs(app, emailP))).status).toBe(403);
    expect((await resumen(await loginAs(app, emailC))).status).toBe(403);
  });
});
