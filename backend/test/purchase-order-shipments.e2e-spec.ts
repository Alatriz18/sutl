import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { ENVIO_BASE, auth, crearTenantConAdmin } from './test-helpers';
import { createTestApp } from './test-app';

// Vínculo OC ↔ embarque contra Postgres real: reparto de una línea en varios
// embarques, límites de cantidad (incluida la concurrencia), reglas de estado,
// regla configurable de despacho automático y aislamiento entre empresas.
describe('Vínculo OC ↔ embarque (e2e)', () => {
  let app: INestApplication;
  const suffix = Date.now();
  let tokenA: string;
  let tokenB: string;
  let proveedorA: string;
  let proveedorB: string;
  let envio1: string;
  let envio2: string;
  let envioB: string;

  const http = () => request(app.getHttpServer());

  async function crearOc(token: string, proveedorId: string, numero: string, lineas: Record<string, unknown>[], confirmar = false) {
    const oc = await http().post('/api/purchase-orders').set(auth(token)).send({ numero, proveedorId, lineas });
    expect(oc.status).toBe(201);
    const id = oc.body.id as string;
    expect((await http().post(`/api/purchase-orders/${id}/transicion`).set(auth(token)).send({ estado: 'emitida' })).status).toBe(201);
    if (confirmar) {
      const c = await http()
        .post(`/api/purchase-orders/${id}/transicion`)
        .set(auth(token))
        .send({ estado: 'confirmada', fechaConfirmadaProveedor: '2026-12-01T12:00:00.000Z' });
      expect(c.status).toBe(201);
    }
    const det = await http().get(`/api/purchase-orders/${id}`).set(auth(token));
    return { id, lineas: det.body.lineas as { id: string; sku: string }[] };
  }

  const vincular = (token: string, ocId: string, shipmentId: string, lineas: { lineaId: string; cantidad: number }[]) =>
    http().post(`/api/purchase-orders/${ocId}/embarques`).set(auth(token)).send({ shipmentId, lineas });

  const crearEnvio = async (token: string, extra: Record<string, unknown> = {}) => {
    const r = await http().post('/api/shipments').set(auth(token)).send({ ...ENVIO_BASE, ...extra });
    expect(r.status).toBe(201);
    return r.body.id as string;
  };

  beforeAll(async () => {
    app = await createTestApp();
    const a = await crearTenantConAdmin(app, `VincA${suffix}`);
    const b = await crearTenantConAdmin(app, `VincB${suffix}`);
    tokenA = a.token;
    tokenB = b.token;
    proveedorA = (await http().post('/api/partners').set(auth(tokenA)).send({ tipo: 'proveedor', nombre: `Prov A ${suffix}` })).body.id;
    proveedorB = (await http().post('/api/partners').set(auth(tokenB)).send({ tipo: 'proveedor', nombre: `Prov B ${suffix}` })).body.id;
    envio1 = await crearEnvio(tokenA, { fechaEstimadaLlegada: '2026-12-20T12:00:00.000Z' });
    envio2 = await crearEnvio(tokenA);
    envioB = await crearEnvio(tokenB);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('reparto de una línea en varios embarques', () => {
    let oc: { id: string; lineas: { id: string; sku: string }[] };

    beforeAll(async () => {
      oc = await crearOc(tokenA, proveedorA, `VINC-1-${suffix}`, [
        { sku: 'RES-001', descripcion: 'Resina', cantidad: 100, unidad: 'kg' },
        { sku: 'PIG-001', descripcion: 'Pigmento', cantidad: 50, unidad: 'kg' },
      ]);
    });

    it('asigna parte de la línea a un embarque y la OC lo muestra', async () => {
      const res = await vincular(tokenA, oc.id, envio1, [{ lineaId: oc.lineas[0].id, cantidad: 60 }]);
      expect(res.status).toBe(201);
      const linea = res.body.lineas.find((l: { sku: string }) => l.sku === 'RES-001');
      expect(linea.embarques).toHaveLength(1);
      expect(linea.embarques[0].cantidad).toBe(60);
      expect(linea.embarques[0].shipment.id).toBe(envio1);
      expect(linea.embarques[0].shipment.fechaEstimadaLlegada).toBe('2026-12-20T12:00:00.000Z');
    });

    it('el resto de la línea puede ir en otro embarque, pero no más de lo pedido', async () => {
      expect((await vincular(tokenA, oc.id, envio2, [{ lineaId: oc.lineas[0].id, cantidad: 40 }])).status).toBe(201);
      const res = await vincular(tokenA, oc.id, envio2, [{ lineaId: oc.lineas[0].id, cantidad: 41 }]);
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('excede lo pedido');
    });

    it('volver a vincular el mismo embarque reemplaza la cantidad (no duplica el registro)', async () => {
      const res = await vincular(tokenA, oc.id, envio2, [{ lineaId: oc.lineas[0].id, cantidad: 30 }]);
      expect(res.status).toBe(201);
      const linea = res.body.lineas.find((l: { sku: string }) => l.sku === 'RES-001');
      expect(linea.embarques).toHaveLength(2);
      expect(linea.embarques.map((e: { cantidad: number }) => e.cantidad).sort()).toEqual([30, 60]);
    });

    it('cantidad 0 quita la línea del embarque', async () => {
      const res = await vincular(tokenA, oc.id, envio2, [{ lineaId: oc.lineas[0].id, cantidad: 0 }]);
      expect(res.status).toBe(201);
      expect(res.body.lineas.find((l: { sku: string }) => l.sku === 'RES-001').embarques).toHaveLength(1);
    });

    it('un embarque puede traer líneas de varias OCs y el envío las muestra', async () => {
      const otra = await crearOc(tokenA, proveedorA, `VINC-2-${suffix}`, [{ sku: 'TAP-1', descripcion: 'Tapa', cantidad: 500 }]);
      expect((await vincular(tokenA, otra.id, envio1, [{ lineaId: otra.lineas[0].id, cantidad: 500 }])).status).toBe(201);
      const envio = await http().get(`/api/shipments/${envio1}`).set(auth(tokenA));
      expect(envio.status).toBe(200);
      const numeros = envio.body.ordenesCompraLineas.map((l: { linea: { purchaseOrder: { numero: string } } }) => l.linea.purchaseOrder.numero).sort();
      expect(numeros).toEqual([`VINC-1-${suffix}`, `VINC-2-${suffix}`]);
    });

    it('desvincular quita toda la carga de esa OC en el embarque; repetirlo da 404', async () => {
      const res = await http().delete(`/api/purchase-orders/${oc.id}/embarques/${envio1}`).set(auth(tokenA));
      expect(res.status).toBe(200);
      expect(res.body.lineas.every((l: { embarques: unknown[] }) => l.embarques.length === 0)).toBe(true);
      expect((await http().delete(`/api/purchase-orders/${oc.id}/embarques/${envio1}`).set(auth(tokenA))).status).toBe(404);
    });
  });

  describe('reglas', () => {
    it('no se vincula a una OC en borrador', async () => {
      const oc = await http()
        .post('/api/purchase-orders')
        .set(auth(tokenA))
        .send({ numero: `VINC-BOR-${suffix}`, proveedorId: proveedorA, lineas: [{ sku: 'X', descripcion: 'X', cantidad: 10 }] });
      const det = await http().get(`/api/purchase-orders/${oc.body.id}`).set(auth(tokenA));
      expect((await vincular(tokenA, oc.body.id, envio1, [{ lineaId: det.body.lineas[0].id, cantidad: 5 }])).status).toBe(400);
    });

    it('rechaza líneas de otra OC y líneas repetidas', async () => {
      const a = await crearOc(tokenA, proveedorA, `VINC-R1-${suffix}`, [{ sku: 'A', descripcion: 'A', cantidad: 10 }]);
      const b = await crearOc(tokenA, proveedorA, `VINC-R2-${suffix}`, [{ sku: 'B', descripcion: 'B', cantidad: 10 }]);
      expect((await vincular(tokenA, a.id, envio1, [{ lineaId: b.lineas[0].id, cantidad: 5 }])).status).toBe(400);
      expect(
        (await vincular(tokenA, a.id, envio1, [
          { lineaId: a.lineas[0].id, cantidad: 2 },
          { lineaId: a.lineas[0].id, cantidad: 3 },
        ])).status,
      ).toBe(400);
    });

    it('rechaza cantidades negativas, con más de 4 decimales o sin líneas (400)', async () => {
      const oc = await crearOc(tokenA, proveedorA, `VINC-V-${suffix}`, [{ sku: 'V', descripcion: 'V', cantidad: 10 }]);
      expect((await vincular(tokenA, oc.id, envio1, [{ lineaId: oc.lineas[0].id, cantidad: -1 }])).status).toBe(400);
      expect((await vincular(tokenA, oc.id, envio1, [{ lineaId: oc.lineas[0].id, cantidad: 1.00001 }])).status).toBe(400);
      expect((await vincular(tokenA, oc.id, envio1, [])).status).toBe(400);
    });

    it('no admite carga en un embarque ya entregado', async () => {
      const entregado = await crearEnvio(tokenA);
      expect((await http().patch(`/api/shipments/${entregado}`).set(auth(tokenA)).send({ estado: 'entregado' })).status).toBe(200);
      const oc = await crearOc(tokenA, proveedorA, `VINC-E-${suffix}`, [{ sku: 'E', descripcion: 'E', cantidad: 10 }]);
      expect((await vincular(tokenA, oc.id, entregado, [{ lineaId: oc.lineas[0].id, cantidad: 5 }])).status).toBe(400);
    });

    it('dos asignaciones simultáneas no pueden sumar más de lo pedido', async () => {
      const oc = await crearOc(tokenA, proveedorA, `VINC-C-${suffix}`, [{ sku: 'CONC', descripcion: 'Concurrencia', cantidad: 100 }]);
      const [e1, e2] = await Promise.all([crearEnvio(tokenA), crearEnvio(tokenA)]);
      const [r1, r2] = await Promise.all([
        vincular(tokenA, oc.id, e1, [{ lineaId: oc.lineas[0].id, cantidad: 70 }]),
        vincular(tokenA, oc.id, e2, [{ lineaId: oc.lineas[0].id, cantidad: 70 }]),
      ]);
      expect([r1.status, r2.status].sort()).toEqual([201, 400]);
      const det = await http().get(`/api/purchase-orders/${oc.id}`).set(auth(tokenA));
      const total = det.body.lineas[0].embarques.reduce((s: number, e: { cantidad: number }) => s + e.cantidad, 0);
      expect(total).toBe(70);
    });
  });

  describe('regla configurable: vincular embarque despacha la OC', () => {
    it('por defecto (perfil general) la OC confirmada sigue confirmada', async () => {
      const oc = await crearOc(tokenA, proveedorA, `VINC-D1-${suffix}`, [{ sku: 'D1', descripcion: 'D1', cantidad: 10 }], true);
      const res = await vincular(tokenA, oc.id, envio1, [{ lineaId: oc.lineas[0].id, cantidad: 10 }]);
      expect(res.status).toBe(201);
      expect(res.body.estado).toBe('confirmada');
    });

    it('con la regla activa, vincular la deja despachada con fecha de despacho', async () => {
      const cfg = await http()
        .patch('/api/tenant-config')
        .set(auth(tokenA))
        .send({ configuracion: { compras: { vincularEmbarqueDespachaOc: true } } });
      expect(cfg.status).toBe(200);
      const oc = await crearOc(tokenA, proveedorA, `VINC-D2-${suffix}`, [{ sku: 'D2', descripcion: 'D2', cantidad: 10 }], true);
      const res = await vincular(tokenA, oc.id, envio1, [{ lineaId: oc.lineas[0].id, cantidad: 10 }]);
      expect(res.body.estado).toBe('despachada');
      expect(res.body.fechaDespacho).not.toBeNull();
    });

    it('la regla no actúa sobre una OC solo emitida', async () => {
      const oc = await crearOc(tokenA, proveedorA, `VINC-D3-${suffix}`, [{ sku: 'D3', descripcion: 'D3', cantidad: 10 }]);
      const res = await vincular(tokenA, oc.id, envio1, [{ lineaId: oc.lineas[0].id, cantidad: 10 }]);
      expect(res.body.estado).toBe('emitida');
    });

    it('con la tolerancia de sobre-recepción del perfil Manufactura se puede asignar hasta el 105%', async () => {
      await http().patch('/api/tenant-config').set(auth(tokenA)).send({ perfil: 'manufactura' });
      const oc = await crearOc(tokenA, proveedorA, `VINC-T-${suffix}`, [{ sku: 'TOL', descripcion: 'Tol', cantidad: 100 }]);
      expect((await vincular(tokenA, oc.id, envio1, [{ lineaId: oc.lineas[0].id, cantidad: 105 }])).status).toBe(201);
      expect((await vincular(tokenA, oc.id, envio1, [{ lineaId: oc.lineas[0].id, cantidad: 105.5 }])).status).toBe(400);
      await http().patch('/api/tenant-config').set(auth(tokenA)).send({ perfil: 'general' });
    });
  });

  describe('aislamiento entre empresas', () => {
    it('B no puede usar un embarque de A en su OC (404) ni vincular a una OC de A', async () => {
      const ocB = await crearOc(tokenB, proveedorB, `VINC-ISO-${suffix}`, [{ sku: 'ISO', descripcion: 'Iso', cantidad: 10 }]);
      expect((await vincular(tokenB, ocB.id, envio1, [{ lineaId: ocB.lineas[0].id, cantidad: 5 }])).status).toBe(404);

      const ocA = await crearOc(tokenA, proveedorA, `VINC-ISO2-${suffix}`, [{ sku: 'ISO2', descripcion: 'Iso2', cantidad: 10 }]);
      expect((await vincular(tokenB, ocA.id, envioB, [{ lineaId: ocA.lineas[0].id, cantidad: 5 }])).status).toBe(404);
      expect((await http().delete(`/api/purchase-orders/${ocA.id}/embarques/${envioB}`).set(auth(tokenB))).status).toBe(404);
    });

    it('B no ve la carga de OCs de A al consultar un embarque', async () => {
      const envio = await http().get(`/api/shipments/${envio1}`).set(auth(tokenB));
      expect(envio.status).toBe(404);
      const propio = await http().get(`/api/shipments/${envioB}`).set(auth(tokenB));
      expect(propio.body.ordenesCompraLineas).toEqual([]);
    });
  });
});
