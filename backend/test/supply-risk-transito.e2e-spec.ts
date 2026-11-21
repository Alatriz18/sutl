import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './test-app';
import { auth, crearTenantConAdmin } from './test-helpers';

const DIA = 86_400_000;

// Llegada estimada de las OC que todavía no viajan: despacho (o fecha comprometida) + días de tránsito de la empresa.
describe('Riesgo: llegada estimada de OC sin embarque (e2e)', () => {
  let app: INestApplication;
  const suffix = Date.now();
  const limiteLoginOriginal = process.env.LOGIN_RATE_LIMIT;
  let a: Awaited<ReturnType<typeof crearTenantConAdmin>>;
  let b: Awaited<ReturnType<typeof crearTenantConAdmin>>;
  const http = () => request(app.getHttpServer());
  const fila = async (token: string, sku: string) => ((await http().get('/api/supply-risk').set(auth(token))).body.filas as { sku: string; semaforo: string; accion: string; reposiciones: { origen: string; fecha: string | null; estimada?: boolean; referencia: string }[] }[]).find((f) => f.sku === sku)!;
  const fijar = (token: string, dias: unknown) => http().patch('/api/tenant-config').set(auth(token)).send({ configuracion: { riesgo: { diasTransitoEstimado: dias } } });

  beforeAll(async () => {
    process.env.LOGIN_RATE_LIMIT = '1000';
    app = await createTestApp();
    a = await crearTenantConAdmin(app, `Transito A ${suffix}`);
    b = await crearTenantConAdmin(app, `Transito B ${suffix}`);
    const bodega = (await http().post('/api/warehouses').set(auth(a.token)).send({ nombre: 'Bodega' })).body.id;
    expect((await http().post('/api/inventory-items').set(auth(a.token)).send({ warehouseId: bodega, sku: 'TR-1', descripcion: 'Resina', cantidad: 1000, unidad: 'kg' })).status).toBe(201);
    expect((await http().put('/api/inventory-policies').set(auth(a.token)).send({ sku: 'TR-1', consumoDiario: 100 })).status).toBe(200);
    const prov = (await http().post('/api/partners').set(auth(a.token)).send({ tipo: 'proveedor', nombre: `Prov ${suffix}` })).body.id;
    const oc = await http().post('/api/purchase-orders').set(auth(a.token)).send({ numero: `TR-${suffix}`, proveedorId: prov, lineas: [{ sku: 'TR-1', descripcion: 'Resina', cantidad: 3000, unidad: 'kg' }] });
    await http().post(`/api/purchase-orders/${oc.body.id}/transicion`).set(auth(a.token)).send({ estado: 'emitida' });
    await http().post(`/api/purchase-orders/${oc.body.id}/transicion`).set(auth(a.token)).send({ estado: 'confirmada', fechaConfirmadaProveedor: new Date(Date.now() + 2 * DIA).toISOString() });
  });

  afterAll(async () => {
    process.env.LOGIN_RATE_LIMIT = limiteLoginOriginal;
    await app.close();
  });

  it('por defecto (0 días) la OC sigue sin fecha de llegada, como antes', async () => {
    const f = await fila(a.token, 'TR-1');
    const oc = f.reposiciones.find((r) => r.origen === 'oc')!;
    expect(oc.fecha).toBeNull();
    expect(oc.estimada).toBeUndefined();
    expect(f.accion).not.toBe('ninguna');
  });

  it('con días de tránsito, la OC confirmada se estima: fecha comprometida + tránsito', async () => {
    expect((await fijar(a.token, 20)).status).toBe(200);
    const f = await fila(a.token, 'TR-1');
    const oc = f.reposiciones.find((r) => r.origen === 'oc')!;
    expect(oc.estimada).toBe(true);
    const esperada = Date.now() + 22 * DIA;
    expect(Math.abs(new Date(oc.fecha!).getTime() - esperada)).toBeLessThan(2 * 60_000);
  });

  it('la estimación entra al cálculo: con 10 días de stock y llegada en 22, sigue en rojo con quiebre', async () => {
    const f = await fila(a.token, 'TR-1');
    expect(f.semaforo).toBe('rojo');
  });

  it('con tránsito corto la estimación alcanza y el SKU deja de estar en rojo', async () => {
    expect((await fijar(a.token, 3)).status).toBe(200); // llega en 5 días, hay stock para 10
    expect((await fila(a.token, 'TR-1')).semaforo).not.toBe('rojo');
  });

  it('valida el rango y no afecta a otra empresa', async () => {
    expect((await fijar(a.token, -1)).status).toBe(400);
    expect((await fijar(a.token, 400)).status).toBe(400);
    expect((await fijar(a.token, 2.5)).status).toBe(400);
    expect((await fijar(a.token, 'mucho')).status).toBe(400);
    expect((await http().get('/api/tenant-config').set(auth(b.token))).body.configuracion.riesgo.diasTransitoEstimado).toBe(0);
  });
});
