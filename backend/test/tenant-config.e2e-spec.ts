import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './test-app';

// Configuración de la operación por tenant contra Postgres real: lectura y
// cambio (perfiles, ajustes propios, validación, roles, aislamiento) y su
// efecto real sobre las recepciones de OC (tolerancia, fecha de
// confirmación, ingreso al inventario según el modo).
const SUPER_ADMIN = { email: 'admin@sutl.dev', password: 'SutlAdmin2026!' };
const PASSWORD = 'PasswordSeguro123';

describe('Configuración de la operación por tenant (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = Date.now();

  let adminA: string;
  let operadorA: string;
  let adminB: string;
  let proveedorA: string;
  let bodegaA: string;
  let bodegaB: string;

  const http = () => request(app.getHttpServer());
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function login(email: string) {
    const res = await http().post('/api/auth/login').send({ email, password: PASSWORD });
    expect(res.status).toBe(200);
    return res.body.accessToken as string;
  }

  async function registrar(superAdminToken: string, tenantId: string, email: string) {
    const res = await http()
      .post('/api/auth/register')
      .set(auth(superAdminToken))
      .send({ tenantId, email, password: PASSWORD, nombre: email });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }

  // Tenant nuevo con un admin_tenant (register crea operadores; el ascenso se
  // hace directo en la base solo como preparación de la prueba).
  async function crearTenantConAdmin(superAdminToken: string, nombre: string) {
    const tenant = await http().post('/api/tenants').set(auth(superAdminToken)).send({ nombre, plan: 'trial' });
    expect(tenant.status).toBe(201);
    const email = `cfg-admin-${nombre.replace(/\W/g, '')}@cfg-test.com`;
    const userId = await registrar(superAdminToken, tenant.body.id, email);
    await prisma.user.update({ where: { id: userId }, data: { rol: 'admin_tenant' } });
    return { tenantId: tenant.body.id as string, token: await login(email) };
  }

  const getConfig = (token: string) => http().get('/api/tenant-config').set(auth(token));
  const patchConfig = (token: string, body: Record<string, unknown>) =>
    http().patch('/api/tenant-config').set(auth(token)).send(body);

  // Crea una OC de una línea y la deja confirmada, lista para recibir.
  async function ocConfirmada(numero: string, linea: Record<string, unknown>) {
    const oc = await http()
      .post('/api/purchase-orders')
      .set(auth(adminA))
      .send({ numero, proveedorId: proveedorA, lineas: [linea] });
    expect(oc.status).toBe(201);
    const id = oc.body.id as string;
    expect((await http().post(`/api/purchase-orders/${id}/transicion`).set(auth(adminA)).send({ estado: 'emitida' })).status).toBe(201);
    const conf = await http()
      .post(`/api/purchase-orders/${id}/transicion`)
      .set(auth(adminA))
      .send({ estado: 'confirmada', fechaConfirmadaProveedor: '2026-12-01T12:00:00.000Z' });
    expect(conf.status).toBe(201);
    return { id, lineaId: conf.body.lineas[0].id as string };
  }

  const recibir = (id: string, body: Record<string, unknown>) =>
    http().post(`/api/purchase-orders/${id}/recepciones`).set(auth(adminA)).send(body);

  async function itemsDeBodega(sku: string) {
    const res = await http().get('/api/inventory-items').set(auth(adminA));
    expect(res.status).toBe(200);
    return (res.body as { sku: string; warehouseId: string; cantidad: number; id: string }[]).filter(
      (i) => i.sku === sku && i.warehouseId === bodegaA,
    );
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const loginSa = await http().post('/api/auth/login').send(SUPER_ADMIN);
    const superAdminToken = loginSa.body.accessToken as string;

    const a = await crearTenantConAdmin(superAdminToken, `CfgA${suffix}`);
    const b = await crearTenantConAdmin(superAdminToken, `CfgB${suffix}`);
    adminA = a.token;
    adminB = b.token;
    const emailOperador = `cfg-op-${suffix}@cfg-test.com`;
    await registrar(superAdminToken, a.tenantId, emailOperador);
    operadorA = await login(emailOperador);

    const prov = await http().post('/api/partners').set(auth(adminA)).send({ tipo: 'proveedor', nombre: `Prov ${suffix}` });
    proveedorA = prov.body.id;
    bodegaA = (await http().post('/api/warehouses').set(auth(adminA)).send({ nombre: 'Bodega planta' })).body.id;
    bodegaB = (await http().post('/api/warehouses').set(auth(adminB)).send({ nombre: 'Bodega B' })).body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('lectura y cambio de la configuración', () => {
    it('un tenant nuevo arranca con el perfil general y sin ajustes propios', async () => {
      const res = await getConfig(adminA);
      expect(res.status).toBe(200);
      expect(res.body.perfil).toBe('general');
      expect(res.body.ajustes).toEqual({});
      expect(res.body.configuracion.compras.toleranciaSobreRecepcionPct).toBe(0);
      expect(res.body.configuracion.inventario.recepcionActualizaInventario).toBe('a_eleccion');
      expect(res.body.perfiles.map((p: { id: string }) => p.id)).toEqual(
        expect.arrayContaining(['general', 'manufactura', 'comercio', 'erp_externo']),
      );
    });

    it('el operador puede leerla pero no cambiarla (403)', async () => {
      expect((await getConfig(operadorA)).status).toBe(200);
      expect((await patchConfig(operadorA, { perfil: 'manufactura' })).status).toBe(403);
    });

    it('elegir un perfil aplica sus valores sugeridos', async () => {
      const res = await patchConfig(adminA, { perfil: 'manufactura' });
      expect(res.status).toBe(200);
      expect(res.body.perfil).toBe('manufactura');
      expect(res.body.configuracion.compras.toleranciaSobreRecepcionPct).toBe(5);
      expect(res.body.configuracion.inventario.recepcionActualizaInventario).toBe('automatico');
    });

    it('un ajuste propio se guarda encima del perfil sin tocar el resto', async () => {
      const res = await patchConfig(adminA, { configuracion: { compras: { diasAlertaAnticipada: 21 } } });
      expect(res.status).toBe(200);
      expect(res.body.ajustes).toEqual({ compras: { diasAlertaAnticipada: 21 } });
      expect(res.body.configuracion.compras.diasAlertaAnticipada).toBe(21);
      expect(res.body.configuracion.compras.toleranciaSobreRecepcionPct).toBe(5);
    });

    it('restablecer vuelve a los valores del perfil', async () => {
      const res = await patchConfig(adminA, { restablecer: true });
      expect(res.body.ajustes).toEqual({});
      expect(res.body.configuracion.compras.diasAlertaAnticipada).toBe(14);
    });

    it('rechaza valores fuera de rango, claves desconocidas y perfiles inexistentes (400)', async () => {
      expect((await patchConfig(adminA, { configuracion: { compras: { toleranciaSobreRecepcionPct: 80 } } })).status).toBe(400);
      expect((await patchConfig(adminA, { configuracion: { compras: { diasAlertaAnticipada: 0 } } })).status).toBe(400);
      expect((await patchConfig(adminA, { configuracion: { inventario: { recepcionActualizaInventario: 'siempre' } } })).status).toBe(400);
      expect((await patchConfig(adminA, { configuracion: { compras: { otraCosa: true } } })).status).toBe(400);
      expect((await patchConfig(adminA, { perfil: 'banca' })).status).toBe(400);
      expect((await patchConfig(adminA, { tenantId: 'otro' })).status).toBe(400);
    });

    it('la configuración de A no afecta a B', async () => {
      const res = await getConfig(adminB);
      expect(res.body.perfil).toBe('general');
      expect(res.body.configuracion.compras.toleranciaSobreRecepcionPct).toBe(0);
    });
  });

  describe('efecto sobre las recepciones de OC', () => {
    it('modo a_eleccion: sin marcar, la recepción no toca el inventario', async () => {
      await patchConfig(adminA, { perfil: 'general' });
      const oc = await ocConfirmada(`CFG-1-${suffix}`, { sku: `SKU-A-${suffix}`, descripcion: 'Tapa', cantidad: 100 });
      const res = await recibir(oc.id, { lineas: [{ lineaId: oc.lineaId, cantidad: 40 }] });
      expect(res.status).toBe(201);
      expect(res.body.lineas[0].recepciones[0].warehouseId).toBeNull();
      expect(await itemsDeBodega(`SKU-A-${suffix}`)).toHaveLength(0);
    });

    it('modo a_eleccion: marcando, entra a la bodega con su movimiento de entrada', async () => {
      const oc = await ocConfirmada(`CFG-2-${suffix}`, { sku: `SKU-B-${suffix}`, descripcion: 'Envase', cantidad: 100 });
      const res = await recibir(oc.id, {
        lineas: [{ lineaId: oc.lineaId, cantidad: 60 }],
        actualizarInventario: true,
        warehouseId: bodegaA,
      });
      expect(res.status).toBe(201);
      expect(res.body.lineas[0].recepciones[0].warehouse).toEqual({ id: bodegaA, nombre: 'Bodega planta' });
      const items = await itemsDeBodega(`SKU-B-${suffix}`);
      expect(items).toHaveLength(1);
      expect(items[0].cantidad).toBe(60);
      const movimientos = await prisma.stockMovement.findMany({ where: { inventoryItemId: items[0].id } });
      expect(movimientos).toEqual([
        expect.objectContaining({ tipo: 'entrada', cantidad: 60, notas: `Recepción OC CFG-2-${suffix}` }),
      ]);
    });

    it('modo a_eleccion: una bodega sin confirmar el ingreso se rechaza (no se ignora en silencio)', async () => {
      const oc = await ocConfirmada(`CFG-3-${suffix}`, { sku: `SKU-C-${suffix}`, descripcion: 'X', cantidad: 10 });
      expect((await recibir(oc.id, { lineas: [{ lineaId: oc.lineaId, cantidad: 1 }], warehouseId: bodegaA })).status).toBe(400);
    });

    it('modo automatico + tolerancia 5%: acepta kg con decimales hasta el 105% y suma al mismo ítem', async () => {
      await patchConfig(adminA, { perfil: 'manufactura' });
      const sku = `RES-${suffix}`;
      const oc = await ocConfirmada(`CFG-4-${suffix}`, { sku, descripcion: 'Resina PET', cantidad: 1000, unidad: 'kg' });

      expect((await recibir(oc.id, { lineas: [{ lineaId: oc.lineaId, cantidad: 10 }] })).status).toBe(400); // falta la bodega

      const primera = await recibir(oc.id, { lineas: [{ lineaId: oc.lineaId, cantidad: 600.5 }], warehouseId: bodegaA });
      expect(primera.status).toBe(201);
      const segunda = await recibir(oc.id, { lineas: [{ lineaId: oc.lineaId, cantidad: 445.25 }], warehouseId: bodegaA });
      expect(segunda.status).toBe(201);
      expect(segunda.body.estado).toBe('recibida'); // 1045.75 ≥ 1000

      const items = await itemsDeBodega(sku);
      expect(items).toHaveLength(1);
      expect(items[0].cantidad).toBeCloseTo(1045.75, 6);
    });

    it('modo automatico + tolerancia 5%: rechaza superar el 105%', async () => {
      const oc = await ocConfirmada(`CFG-5-${suffix}`, { sku: `RES2-${suffix}`, descripcion: 'Resina', cantidad: 100, unidad: 'kg' });
      const res = await recibir(oc.id, { lineas: [{ lineaId: oc.lineaId, cantidad: 105.01 }], warehouseId: bodegaA });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('tolerancia de 5%');
      expect(await itemsDeBodega(`RES2-${suffix}`)).toHaveLength(0);
    });

    it('dos recepciones simultáneas del mismo SKU nuevo crean un solo ítem (no duplican)', async () => {
      const sku = `CONC-${suffix}`;
      const [oc1, oc2] = await Promise.all([
        ocConfirmada(`CFG-C1-${suffix}`, { sku, descripcion: 'Etiqueta', cantidad: 50 }),
        ocConfirmada(`CFG-C2-${suffix}`, { sku, descripcion: 'Etiqueta', cantidad: 50 }),
      ]);
      const [r1, r2] = await Promise.all([
        recibir(oc1.id, { lineas: [{ lineaId: oc1.lineaId, cantidad: 50 }], warehouseId: bodegaA }),
        recibir(oc2.id, { lineas: [{ lineaId: oc2.lineaId, cantidad: 50 }], warehouseId: bodegaA }),
      ]);
      expect([r1.status, r2.status]).toEqual([201, 201]);
      const items = await itemsDeBodega(sku);
      expect(items).toHaveLength(1);
      expect(items[0].cantidad).toBe(100);
    });

    it('la bodega debe ser del propio tenant', async () => {
      const oc = await ocConfirmada(`CFG-6-${suffix}`, { sku: `SKU-D-${suffix}`, descripcion: 'X', cantidad: 10 });
      const res = await recibir(oc.id, { lineas: [{ lineaId: oc.lineaId, cantidad: 5 }], warehouseId: bodegaB });
      expect(res.status).toBe(404);
      const oc2 = await http().get(`/api/purchase-orders/${oc.id}`).set(auth(adminA));
      expect(oc2.body.lineas[0].cantidadRecibida).toBe(0);
    });

    it('rechaza ingresar un SKU cuya unidad no coincide con la del inventario (y no deja nada a medias)', async () => {
      const sku = `RES-${suffix}`; // ya está en la bodega en kg
      const oc = await ocConfirmada(`CFG-7-${suffix}`, { sku, descripcion: 'Resina en sacos', cantidad: 10, unidad: 'saco' });
      const res = await recibir(oc.id, { lineas: [{ lineaId: oc.lineaId, cantidad: 5 }], warehouseId: bodegaA });
      expect(res.status).toBe(400);
      const oc2 = await http().get(`/api/purchase-orders/${oc.id}`).set(auth(adminA));
      expect(oc2.body.lineas[0].cantidadRecibida).toBe(0);
      expect(oc2.body.lineas[0].recepciones).toHaveLength(0);
    });

    it('modo nunca (inventario en ERP propio): recibe la OC pero rechaza mover inventario', async () => {
      await patchConfig(adminA, { perfil: 'erp_externo' });
      const oc = await ocConfirmada(`CFG-8-${suffix}`, { sku: `SKU-E-${suffix}`, descripcion: 'X', cantidad: 10 });
      expect((await recibir(oc.id, { lineas: [{ lineaId: oc.lineaId, cantidad: 5 }], warehouseId: bodegaA })).status).toBe(400);
      const ok = await recibir(oc.id, { lineas: [{ lineaId: oc.lineaId, cantidad: 5 }] });
      expect(ok.status).toBe(201);
      expect(await itemsDeBodega(`SKU-E-${suffix}`)).toHaveLength(0);
    });

    it('si la empresa no exige fecha de confirmación, confirma sin ella', async () => {
      const crear = await http()
        .post('/api/purchase-orders')
        .set(auth(adminA))
        .send({ numero: `CFG-9-${suffix}`, proveedorId: proveedorA, lineas: [{ sku: 'X', descripcion: 'X', cantidad: 1 }] });
      const id = crear.body.id;
      await http().post(`/api/purchase-orders/${id}/transicion`).set(auth(adminA)).send({ estado: 'emitida' });
      expect((await http().post(`/api/purchase-orders/${id}/transicion`).set(auth(adminA)).send({ estado: 'confirmada' })).status).toBe(400);

      await patchConfig(adminA, { configuracion: { compras: { exigirFechaConfirmacion: false } } });
      const res = await http().post(`/api/purchase-orders/${id}/transicion`).set(auth(adminA)).send({ estado: 'confirmada' });
      expect(res.status).toBe(201);
      expect(res.body.estado).toBe('confirmada');
      expect(res.body.fechaConfirmadaProveedor).toBeNull();
    });
  });
});
