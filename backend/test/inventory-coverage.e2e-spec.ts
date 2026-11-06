import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { ENVIO_BASE, auth, crearTenantConAdmin } from './test-helpers';
import { createTestApp } from './test-app';

type Fila = {
  sku: string;
  stock: number | null;
  stockOrigen: string;
  diasCobertura: number | null;
  bajoSeguridad: boolean;
  bajoCobertura: boolean;
  sinPolitica: boolean;
  pendienteOc: number;
  enCamino: number;
  proximaEta: string | null;
  policyId: string | null;
};

// Cobertura de inventario contra Postgres real: políticas por SKU, días de
// cobertura, alertas según la configuración de la empresa, entradas previstas
// desde OCs y embarques, existencias externas (ERP) e importación masiva.
describe('Cobertura de inventario (e2e)', () => {
  let app: INestApplication;
  const suffix = Date.now();
  let tokenA: string;
  let tokenB: string;
  let bodegaA: string;

  const http = () => request(app.getHttpServer());
  const cobertura = (token: string) => http().get('/api/inventory-coverage').set(auth(token));
  const fila = (body: { filas: Fila[] }, sku: string) => body.filas.find((f) => f.sku === sku)!;
  const politica = (token: string, body: Record<string, unknown>) => http().put('/api/inventory-policies').set(auth(token)).send(body);
  const config = (token: string, body: Record<string, unknown>) => http().patch('/api/tenant-config').set(auth(token)).send(body);

  async function item(token: string, warehouseId: string, sku: string, cantidad: number, unidad = 'kg') {
    const r = await http().post('/api/inventory-items').set(auth(token)).send({ warehouseId, sku, descripcion: `Item ${sku}`, cantidad, unidad });
    expect(r.status).toBe(201);
  }

  beforeAll(async () => {
    app = await createTestApp();
    tokenA = (await crearTenantConAdmin(app, `CobA${suffix}`)).token;
    tokenB = (await crearTenantConAdmin(app, `CobB${suffix}`)).token;
    bodegaA = (await http().post('/api/warehouses').set(auth(tokenA)).send({ nombre: 'Bodega planta' })).body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('una empresa sin datos ve la cobertura vacía y el umbral de su perfil', async () => {
    const res = await cobertura(tokenA);
    expect(res.status).toBe(200);
    expect(res.body.resumen).toEqual({ skus: 0, conPolitica: 0, sinPolitica: 0, bajoSeguridad: 0, bajoCobertura: 0 });
    expect(res.body.umbralDias).toBe(15);
    expect(res.body.modoInventario).toBe('a_eleccion');
  });

  describe('días de cobertura y alertas', () => {
    beforeAll(async () => {
      await item(tokenA, bodegaA, 'RES-1', 300);
      await item(tokenA, bodegaA, 'RES-1', 200); // mismo SKU en otro ítem: se suma
      await item(tokenA, bodegaA, 'PIG-1', 80);
      await item(tokenA, bodegaA, 'SUELTO-1', 10);
    });

    it('suma el stock del SKU y calcula los días de cobertura con la política', async () => {
      const p = await politica(tokenA, { sku: 'RES-1', consumoDiario: 50, stockSeguridad: 100, leadTimeDias: 30 });
      expect(p.status).toBe(200);
      const f = fila((await cobertura(tokenA)).body, 'RES-1');
      expect(f.stock).toBe(500);
      expect(f.stockOrigen).toBe('sutl');
      expect(f.diasCobertura).toBe(10);
      expect(f.bajoCobertura).toBe(true); // 10 < 15 días (perfil general)
      expect(f.bajoSeguridad).toBe(false);
    });

    it('marca bajo stock de seguridad aunque la cobertura sea larga', async () => {
      await politica(tokenA, { sku: 'PIG-1', consumoDiario: 1, stockSeguridad: 100 });
      const f = fila((await cobertura(tokenA)).body, 'PIG-1');
      expect(f.diasCobertura).toBe(80);
      expect(f.bajoCobertura).toBe(false);
      expect(f.bajoSeguridad).toBe(true);
    });

    it('un SKU en inventario sin política se marca sin política y sin días de cobertura', async () => {
      const f = fila((await cobertura(tokenA)).body, 'SUELTO-1');
      expect(f.sinPolitica).toBe(true);
      expect(f.diasCobertura).toBeNull();
      expect(f.policyId).toBeNull();
    });

    it('lo que requiere atención sale primero', async () => {
      const skus = (await cobertura(tokenA)).body.filas.map((f: Fila) => f.sku);
      expect(skus.indexOf('RES-1')).toBeLessThan(skus.indexOf('SUELTO-1'));
      expect(skus.indexOf('PIG-1')).toBeLessThan(skus.indexOf('SUELTO-1'));
    });

    it('el umbral de alerta sale de la configuración de la empresa', async () => {
      expect((await config(tokenA, { configuracion: { inventario: { diasCoberturaAlerta: 5 } } })).status).toBe(200);
      const res = await cobertura(tokenA);
      expect(res.body.umbralDias).toBe(5);
      expect(fila(res.body, 'RES-1').bajoCobertura).toBe(false); // 10 ≥ 5
      await config(tokenA, { restablecer: true });
    });

    it('PUT reemplaza la política y DELETE la elimina', async () => {
      const p = await politica(tokenA, { sku: 'RES-1', consumoDiario: 25 });
      expect(p.body.stockSeguridad).toBe(0);
      expect(p.body.leadTimeDias).toBeNull();
      expect(fila((await cobertura(tokenA)).body, 'RES-1').diasCobertura).toBe(20);
      expect((await http().delete(`/api/inventory-policies/${p.body.id}`).set(auth(tokenA))).status).toBe(200);
      expect(fila((await cobertura(tokenA)).body, 'RES-1').sinPolitica).toBe(true);
      expect((await http().delete(`/api/inventory-policies/${p.body.id}`).set(auth(tokenA))).status).toBe(404);
      await politica(tokenA, { sku: 'RES-1', consumoDiario: 50, stockSeguridad: 100, leadTimeDias: 30 });
    });

    it('rechaza consumos negativos, decimales de más, campos desconocidos y SKU vacío (400)', async () => {
      expect((await politica(tokenA, { sku: 'X', consumoDiario: -1 })).status).toBe(400);
      expect((await politica(tokenA, { sku: 'X', consumoDiario: 1.00001 })).status).toBe(400);
      expect((await politica(tokenA, { sku: 'X', consumoDiario: 1, tenantId: 'otro' })).status).toBe(400);
      expect((await politica(tokenA, { sku: '   ', consumoDiario: 1 })).status).toBe(400);
    });
  });

  describe('entradas previstas desde OCs y embarques', () => {
    it('muestra lo pendiente de OCs vivas, lo que ya viaja y la próxima ETA', async () => {
      const prov = (await http().post('/api/partners').set(auth(tokenA)).send({ tipo: 'proveedor', nombre: `Prov ${suffix}` })).body.id;
      const oc = await http()
        .post('/api/purchase-orders')
        .set(auth(tokenA))
        .send({ numero: `COB-${suffix}`, proveedorId: prov, lineas: [{ sku: 'RES-1', descripcion: 'Resina', cantidad: 1000, unidad: 'kg' }] });
      const ocId = oc.body.id as string;
      await http().post(`/api/purchase-orders/${ocId}/transicion`).set(auth(tokenA)).send({ estado: 'emitida' });
      const lineaId = oc.body.lineas[0].id as string;
      const envio = (await http().post('/api/shipments').set(auth(tokenA)).send({ ...ENVIO_BASE, fechaEstimadaLlegada: '2026-12-15T12:00:00.000Z' })).body.id;
      expect((await http().post(`/api/purchase-orders/${ocId}/embarques`).set(auth(tokenA)).send({ shipmentId: envio, lineas: [{ lineaId, cantidad: 400 }] })).status).toBe(201);

      const f = fila((await cobertura(tokenA)).body, 'RES-1');
      expect(f.pendienteOc).toBe(1000);
      expect(f.enCamino).toBe(400);
      expect(f.proximaEta).toBe('2026-12-15T12:00:00.000Z');

      // Cuando el embarque se entrega ya no cuenta como "en camino".
      await http().patch(`/api/shipments/${envio}`).set(auth(tokenA)).send({ estado: 'entregado' });
      expect(fila((await cobertura(tokenA)).body, 'RES-1').enCamino).toBe(0);

      // Una OC cancelada deja de sumar a lo pendiente.
      await http().post(`/api/purchase-orders/${ocId}/transicion`).set(auth(tokenA)).send({ estado: 'cancelada', motivo: 'prueba' });
      expect(fila((await cobertura(tokenA)).body, 'RES-1').pendienteOc).toBe(0);
    });
  });

  describe('empresa con inventario en su ERP (existencias externas)', () => {
    it('con el inventario en SUTL se rechazan las existencias externas', async () => {
      expect((await politica(tokenA, { sku: 'EXT-1', consumoDiario: 10, existenciasExternas: 500 })).status).toBe(400);
    });

    it('en modo "nunca" el stock sale de lo que reporta el ERP, no de Almacén', async () => {
      await config(tokenA, { perfil: 'erp_externo' });
      expect((await politica(tokenA, { sku: 'EXT-1', consumoDiario: 10, existenciasExternas: 120 })).status).toBe(200);
      let res = await cobertura(tokenA);
      expect(res.body.modoInventario).toBe('nunca');
      const f = fila(res.body, 'EXT-1');
      expect(f.stock).toBe(120);
      expect(f.stockOrigen).toBe('externo');
      expect(f.diasCobertura).toBe(12);
      // RES-1 tiene 500 kg en Almacén, pero acá no cuentan (el ERP manda) y no reportó existencias.
      res = await cobertura(tokenA);
      expect(fila(res.body, 'RES-1').stock).toBeNull();
      expect(fila(res.body, 'RES-1').diasCobertura).toBeNull();
      await config(tokenA, { perfil: 'general' });
    });
  });

  describe('importación masiva', () => {
    const importar = (token: string, body: Record<string, unknown>) =>
      http().post('/api/inventory-policies/importar').set(auth(token)).send(body);

    it('simular informa fila por fila y no guarda nada', async () => {
      const res = await importar(tokenA, {
        simular: true,
        filas: [
          { sku: 'IMP-1', consumoDiario: 5 },
          { sku: 'IMP-2', consumoDiario: -3 },
          { sku: 'IMP-1', consumoDiario: 9 },
          { sku: '', consumoDiario: 1 },
          { sku: 'IMP-3', consumoDiario: 2, existenciasExternas: 5 },
        ],
      });
      expect(res.status).toBe(201);
      expect(res.body.resumen).toMatchObject({ total: 5, validas: 1, aplicadas: 0, conErrores: 4 });
      expect(res.body.filas[1].estado).toBe('error');
      expect(res.body.filas[2].mensajes.join(' ')).toContain('SKU repetido');
      expect(res.body.filas[4].mensajes.join(' ')).toContain('inventario en SUTL');
      const lista = await http().get('/api/inventory-policies').set(auth(tokenA));
      expect(lista.body.some((p: { sku: string }) => p.sku === 'IMP-1')).toBe(false);
    });

    it('importar de verdad guarda las filas válidas y deja fuera las que fallan', async () => {
      const res = await importar(tokenA, {
        filas: [
          { sku: 'IMP-1', consumoDiario: 5, stockSeguridad: 20, leadTimeDias: 10 },
          { sku: 'IMP-2', consumoDiario: 'mucho' },
        ],
      });
      expect(res.body.resumen).toMatchObject({ aplicadas: 1, conErrores: 1 });
      const lista = (await http().get('/api/inventory-policies').set(auth(tokenA))).body as { sku: string; stockSeguridad: number }[];
      expect(lista.find((p) => p.sku === 'IMP-1')?.stockSeguridad).toBe(20);
      expect(lista.some((p) => p.sku === 'IMP-2')).toBe(false);
    });

    it('repetir la importación actualiza sin duplicar', async () => {
      await importar(tokenA, { filas: [{ sku: 'IMP-1', consumoDiario: 7 }] });
      const lista = (await http().get('/api/inventory-policies').set(auth(tokenA))).body as { sku: string; consumoDiario: number }[];
      const imp1 = lista.filter((p) => p.sku === 'IMP-1');
      expect(imp1).toHaveLength(1);
      expect(imp1[0].consumoDiario).toBe(7);
    });

    it('rechaza lotes que no son una lista de objetos o que pasan el máximo', async () => {
      expect((await importar(tokenA, { filas: 'no' })).status).toBe(400);
      expect((await importar(tokenA, { filas: [1, 2] })).status).toBe(400);
      expect((await importar(tokenA, { filas: Array.from({ length: 5001 }, () => ({ sku: 'X', consumoDiario: 1 })), simular: true })).status).toBe(400);
    });

    it('un lote enorme responde 413 (no un error interno) y un JSON roto responde 400', async () => {
      const enorme = await importar(tokenA, { filas: [{ sku: 'X'.repeat(6 * 1024 * 1024), consumoDiario: 1 }], simular: true });
      expect(enorme.status).toBe(413);
      expect(enorme.body.message).toContain('demasiado grande');
      const roto = await http().post('/api/inventory-policies/importar').set(auth(tokenA)).set('Content-Type', 'application/json').send('{"filas": [');
      expect(roto.status).toBe(400);
    });
  });

  describe('aislamiento entre empresas', () => {
    it('B no ve datos de A y no puede borrar sus políticas', async () => {
      const resB = await cobertura(tokenB);
      expect(resB.body.filas).toEqual([]);
      const listaA = (await http().get('/api/inventory-policies').set(auth(tokenA))).body as { id: string }[];
      expect(listaA.length).toBeGreaterThan(0);
      expect((await http().delete(`/api/inventory-policies/${listaA[0].id}`).set(auth(tokenB))).status).toBe(404);
      expect((await http().get('/api/inventory-policies').set(auth(tokenB))).body).toEqual([]);
    });

    it('la misma SKU en dos empresas son políticas independientes', async () => {
      await politica(tokenB, { sku: 'RES-1', consumoDiario: 1000 });
      const a = fila((await cobertura(tokenA)).body, 'RES-1');
      expect(a.diasCobertura).toBe(10);
    });
  });
});
