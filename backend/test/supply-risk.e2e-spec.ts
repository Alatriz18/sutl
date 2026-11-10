import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { ENVIO_BASE, auth, crearTenantConAdmin } from './test-helpers';
import { createTestApp } from './test-app';

type Fila = {
  sku: string;
  semaforo: string;
  accion: string;
  motivo: string;
  diasSinStock: number;
  fechaQuiebre: string | null;
  reposiciones: { origen: string; referencia: string; cantidad: number; fecha: string | null }[];
};

// Motor de riesgo de abastecimiento contra Postgres real: cruza stock, política,
// OCs vivas y la ETA de los embarques vinculados.
describe('Riesgo de abastecimiento (e2e)', () => {
  let app: INestApplication;
  const suffix = Date.now();
  let tokenA: string;
  let tokenB: string;
  let bodegaA: string;

  const http = () => request(app.getHttpServer());
  const riesgo = (token: string) => http().get('/api/supply-risk').set(auth(token));
  const fila = (body: { filas: Fila[] }, sku: string) => body.filas.find((f) => f.sku === sku)!;
  const enDias = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

  async function sku(token: string, bodega: string, codigo: string, stock: number, consumoDiario: number, extra: Record<string, unknown> = {}) {
    expect((await http().post('/api/inventory-items').set(auth(token)).send({ warehouseId: bodega, sku: codigo, descripcion: codigo, cantidad: stock, unidad: 'kg' })).status).toBe(201);
    expect((await http().put('/api/inventory-policies').set(auth(token)).send({ sku: codigo, consumoDiario, ...extra })).status).toBe(200);
  }

  beforeAll(async () => {
    app = await createTestApp();
    tokenA = (await crearTenantConAdmin(app, `RiesgoA${suffix}`)).token;
    tokenB = (await crearTenantConAdmin(app, `RiesgoB${suffix}`)).token;
    bodegaA = (await http().post('/api/warehouses').set(auth(tokenA)).send({ nombre: 'Bodega' })).body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('sin sesión recibe 401', async () => {
    expect((await http().get('/api/supply-risk')).status).toBe(401);
  });

  it('una empresa sin datos recibe todo en cero', async () => {
    const r = await riesgo(tokenB);
    expect(r.status).toBe(200);
    expect(r.body.resumen).toMatchObject({ rojo: 0, amarillo: 0, verde: 0, sinDatos: 0 });
    expect(r.body.filas).toEqual([]);
  });

  it('un SKU sin política sale como "sin datos" con el motivo', async () => {
    expect((await http().post('/api/inventory-items').set(auth(tokenA)).send({ warehouseId: bodegaA, sku: 'SIN-POL', descripcion: 'x', cantidad: 5, unidad: 'kg' })).status).toBe(201);
    const f = fila((await riesgo(tokenA)).body, 'SIN-POL');
    expect(f.semaforo).toBe('sin_datos');
    expect(f.motivo).toMatch(/no tiene política/);
  });

  it('mucho stock → verde, sin acción', async () => {
    await sku(tokenA, bodegaA, 'VERDE-1', 10000, 100);
    const f = fila((await riesgo(tokenA)).body, 'VERDE-1');
    expect(f.semaforo).toBe('verde');
    expect(f.accion).toBe('ninguna');
  });

  it('se acaba antes de que llegue el embarque → rojo, con días sin stock y la OC que falta despachar', async () => {
    await sku(tokenA, bodegaA, 'ROJO-1', 1000, 100); // 10 días de stock
    const prov = (await http().post('/api/partners').set(auth(tokenA)).send({ tipo: 'proveedor', nombre: `Prov ${suffix}` })).body.id;
    const oc = await http().post('/api/purchase-orders').set(auth(tokenA)).send({
      numero: `RIE-${suffix}`,
      proveedorId: prov,
      lineas: [{ sku: 'ROJO-1', descripcion: 'Resina', cantidad: 1000, unidad: 'kg' }],
    });
    await http().post(`/api/purchase-orders/${oc.body.id}/transicion`).set(auth(tokenA)).send({ estado: 'emitida' });
    const envio = await http().post('/api/shipments').set(auth(tokenA)).send({ ...ENVIO_BASE, fechaEstimadaLlegada: enDias(15) });
    const vinculo = await http().post(`/api/purchase-orders/${oc.body.id}/embarques`).set(auth(tokenA)).send({
      shipmentId: envio.body.id,
      lineas: [{ lineaId: oc.body.lineas[0].id, cantidad: 500 }],
    });
    expect(vinculo.status).toBe(201);

    const f = fila((await riesgo(tokenA)).body, 'ROJO-1');
    expect(f.semaforo).toBe('rojo');
    expect(f.diasSinStock).toBeGreaterThan(4.5);
    expect(f.diasSinStock).toBeLessThan(5.5);
    // Lo que no viaja todavía (500) está en una OC sin despachar: hay que urgir al proveedor.
    expect(f.accion).toBe('adelantar_proveedor');
    expect(f.reposiciones).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ origen: 'embarque', cantidad: 500 }),
        expect.objectContaining({ origen: 'oc', cantidad: 500, fecha: null, referencia: `RIE-${suffix}` }),
      ]),
    );

    // Cuando el embarque se entrega deja de contar como reposición.
    await http().patch(`/api/shipments/${envio.body.id}`).set(auth(tokenA)).send({ estado: 'entregado' });
    const despues = fila((await riesgo(tokenA)).body, 'ROJO-1');
    expect(despues.reposiciones.some((r) => r.origen === 'embarque')).toBe(false);
  });

  it('sin nada en camino y con lead time que no alcanza → rojo, compra urgente', async () => {
    await sku(tokenA, bodegaA, 'ROJO-2', 500, 100, { leadTimeDias: 30 });
    const f = fila((await riesgo(tokenA)).body, 'ROJO-2');
    expect(f.semaforo).toBe('rojo');
    expect(f.accion).toBe('compra_urgente');
  });

  it('ordena lo urgente primero y resume por semáforo', async () => {
    const r = (await riesgo(tokenA)).body as { filas: Fila[]; resumen: { rojo: number; verde: number; sinDatos: number } };
    const orden = r.filas.map((f) => f.semaforo);
    const rank: Record<string, number> = { rojo: 0, amarillo: 1, verde: 2, sin_datos: 3 };
    expect([...orden].sort((a, b) => rank[a] - rank[b])).toEqual(orden);
    expect(r.resumen.rojo).toBeGreaterThanOrEqual(1);
    expect(r.resumen.verde).toBeGreaterThanOrEqual(1);
    expect(r.resumen.sinDatos).toBeGreaterThanOrEqual(1);
  });

  it('aislamiento: otra empresa no ve los SKU de A', async () => {
    const r = await riesgo(tokenB);
    expect(r.body.filas.map((f: Fila) => f.sku)).not.toEqual(expect.arrayContaining(['ROJO-1']));
    expect(r.body.filas).toEqual([]);
  });
});
