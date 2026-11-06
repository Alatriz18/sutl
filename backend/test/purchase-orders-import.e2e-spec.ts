import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { auth, crearTenantConAdmin } from './test-helpers';
import { createTestApp } from './test-app';

// Importación de OCs desde Excel/CSV contra Postgres real: validación fila por
// fila, agrupación por N° de OC, proveedores (existentes y por crear), carga
// repetible, simulación sin efectos, aislamiento y mapeos guardados por empresa.
describe('Importación de OCs (e2e)', () => {
  let app: INestApplication;
  const suffix = Date.now();
  let tokenA: string;
  let tokenB: string;

  const http = () => request(app.getHttpServer());
  const importar = (token: string, body: Record<string, unknown>) =>
    http().post('/api/purchase-orders/importar').set(auth(token)).send(body);
  const listar = async (token: string) =>
    (await http().get('/api/purchase-orders').set(auth(token))).body as { numero: string; estado: string; proveedor: { nombre: string }; lineas: unknown[] }[];
  const proveedores = async (token: string) =>
    ((await http().get('/api/partners?tipo=proveedor').set(auth(token))).body as { nombre: string; tipo: string }[]).filter((p) => p.tipo === 'proveedor');

  const n = (s: string) => `IMP-${s}-${suffix}`;
  const fila = (numero: string, extra: Record<string, unknown> = {}) => ({
    numero,
    proveedor: `Plásticos del Sur ${suffix}`,
    sku: 'RES-001',
    descripcion: 'Resina PET',
    cantidad: 100,
    unidad: 'kg',
    precioUnitario: 1.5,
    ...extra,
  });

  beforeAll(async () => {
    app = await createTestApp();
    tokenA = (await crearTenantConAdmin(app, `ImpA${suffix}`)).token;
    tokenB = (await crearTenantConAdmin(app, `ImpB${suffix}`)).token;
    const prov = await http()
      .post('/api/partners')
      .set(auth(tokenA))
      .send({ tipo: 'proveedor', nombre: `Plásticos del Sur ${suffix}`, taxId: `1790${suffix}001` });
    expect(prov.status).toBe(201);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('simulación e importación', () => {
    const filas = () => [
      fila(n('A'), { fechaRequerida: '2026-12-15', incoterm: 'FOB', moneda: 'usd' }),
      fila(n('A'), { sku: 'PIG-001', descripcion: 'Pigmento', cantidad: 20.5 }), // 2.ª línea de la misma OC, sin repetir cabecera
      fila(n('B'), { sku: 'TAP-28', descripcion: 'Tapa', cantidad: 5000, unidad: 'unidad', precioUnitario: undefined }),
    ];

    it('simular valida y resume sin guardar nada', async () => {
      const res = await importar(tokenA, { filas: filas(), simular: true });
      expect(res.status).toBe(201);
      expect(res.body.resumen).toMatchObject({ filas: 3, ordenes: 2, nuevas: 2, omitidas: 0, conErrores: 0, proveedoresACrear: 0 });
      expect((await listar(tokenA)).some((o) => o.numero === n('A'))).toBe(false);
    });

    it('importar crea las OCs en borrador con sus líneas y el proveedor existente', async () => {
      const res = await importar(tokenA, { filas: filas() });
      expect(res.body.resumen).toMatchObject({ nuevas: 2, conErrores: 0 });
      const ocs = await listar(tokenA);
      const a = ocs.find((o) => o.numero === n('A'))!;
      expect(a.estado).toBe('borrador');
      expect(a.lineas).toHaveLength(2);
      expect(a.proveedor.nombre).toBe(`Plásticos del Sur ${suffix}`);
      const detalle = (await http().get(`/api/purchase-orders`).set(auth(tokenA))).body.find((o: { numero: string }) => o.numero === n('A'));
      const completa = await http().get(`/api/purchase-orders/${detalle.id}`).set(auth(tokenA));
      expect(completa.body.incoterm).toBe('FOB');
      expect(completa.body.moneda).toBe('USD');
      expect(completa.body.fechaRequerida).toContain('2026-12-15');
      expect(completa.body.lineas.find((l: { sku: string }) => l.sku === 'PIG-001').cantidad).toBe(20.5);
    });

    it('repetir la misma carga no duplica nada: las OCs existentes se omiten', async () => {
      const res = await importar(tokenA, { filas: filas() });
      expect(res.body.resumen).toMatchObject({ nuevas: 0, omitidas: 2, conErrores: 0 });
      expect(res.body.ordenes[0].mensajes[0]).toContain('Ya existe');
      expect((await listar(tokenA)).filter((o) => o.numero === n('A'))).toHaveLength(1);
    });
  });

  describe('errores fila por fila', () => {
    it('una fila inválida deja fuera su OC completa, no a medias, y las demás se importan', async () => {
      const res = await importar(tokenA, {
        filas: [
          fila(n('OK1')),
          fila(n('MALA')),
          fila(n('MALA'), { sku: 'X', cantidad: 0 }),
          fila(n('OK2')),
          fila('', {}),
          fila(n('SINSKU'), { sku: '' }),
        ],
      });
      expect(res.status).toBe(201);
      expect(res.body.resumen.nuevas).toBe(2);
      const mala = res.body.ordenes.find((o: { numero: string }) => o.numero === n('MALA'));
      expect(mala.estado).toBe('error');
      expect(res.body.errores.map((e: { fila: number }) => e.fila).sort()).toEqual([3, 5, 6]);
      const numeros = (await listar(tokenA)).map((o) => o.numero);
      expect(numeros).toContain(n('OK1'));
      expect(numeros).toContain(n('OK2'));
      expect(numeros).not.toContain(n('MALA'));
      expect(numeros).not.toContain(n('SINSKU'));
    });

    it('los mensajes dicen qué campo falló', async () => {
      const res = await importar(tokenA, { simular: true, filas: [fila(n('M1'), { incoterm: 'XXX', moneda: 'DOLARES', cantidad: 1.00001, campoRaro: 1 })] });
      const mensajes = res.body.errores[0].mensajes.join(' | ');
      expect(mensajes).toMatch(/incoterm/);
      expect(mensajes).toMatch(/moneda/);
      expect(mensajes).toMatch(/cantidad/);
      expect(mensajes).toMatch(/campoRaro/);
    });

    it('rechaza cabeceras contradictorias entre las filas de una misma OC', async () => {
      const res = await importar(tokenA, {
        simular: true,
        filas: [fila(n('CONF'), { moneda: 'USD' }), fila(n('CONF'), { moneda: 'EUR' })],
      });
      expect(res.body.ordenes[0].estado).toBe('error');
      expect(res.body.ordenes[0].mensajes.join(' ')).toContain('moneda');
    });

    it('exige proveedor y limita las líneas por OC', async () => {
      const sinProv = await importar(tokenA, { simular: true, filas: [{ ...fila(n('SP')), proveedor: undefined }] });
      expect(sinProv.body.ordenes[0].mensajes.join(' ')).toContain('Falta el proveedor');
      const muchas = await importar(tokenA, { simular: true, filas: Array.from({ length: 501 }, (_, i) => fila(n('GRANDE'), { sku: `S${i}` })) });
      expect(muchas.body.ordenes[0].mensajes.join(' ')).toContain('máximo es 500');
    });

    it('rechaza cuerpos que no son una lista de filas (400)', async () => {
      expect((await importar(tokenA, { filas: 'no' })).status).toBe(400);
      expect((await importar(tokenA, { filas: [1] })).status).toBe(400);
      expect((await importar(tokenA, {})).status).toBe(400);
    });
  });

  describe('proveedores', () => {
    it('un proveedor que no existe es error, salvo que se pida crearlo', async () => {
      const filaNueva = fila(n('NP1'), { proveedor: `Empaques Nuevos ${suffix}` });
      const sin = await importar(tokenA, { simular: true, filas: [filaNueva] });
      expect(sin.body.ordenes[0].estado).toBe('error');
      expect(sin.body.ordenes[0].mensajes.join(' ')).toContain('Proveedor no encontrado');

      const simulando = await importar(tokenA, { simular: true, crearProveedores: true, filas: [filaNueva] });
      expect(simulando.body.resumen).toMatchObject({ nuevas: 1, proveedoresACrear: 1 });
      expect((await proveedores(tokenA)).some((p) => p.nombre === `Empaques Nuevos ${suffix}`)).toBe(false);

      await importar(tokenA, { crearProveedores: true, filas: [filaNueva, fila(n('NP2'), { proveedor: `Empaques Nuevos ${suffix}` })] });
      const creados = (await proveedores(tokenA)).filter((p) => p.nombre === `Empaques Nuevos ${suffix}`);
      expect(creados).toHaveLength(1); // dos OCs del mismo proveedor nuevo: se crea una sola vez
    });

    it('el proveedor nuevo no se crea si su OC no se importa (existe o tiene errores)', async () => {
      await importar(tokenA, { crearProveedores: true, filas: [fila(n('NP3'), { proveedor: `Fantasma ${suffix}`, cantidad: 0 })] });
      expect((await proveedores(tokenA)).some((p) => p.nombre === `Fantasma ${suffix}`)).toBe(false);
    });

    it('se encuentra por RUC/Tax ID aunque el nombre no coincida', async () => {
      const res = await importar(tokenA, {
        simular: true,
        filas: [fila(n('RUC'), { proveedor: 'Nombre distinto', proveedorTaxId: `1790${suffix}001` })],
      });
      expect(res.body.ordenes[0].estado).toBe('nueva');
      expect(res.body.ordenes[0].proveedor).toBe(`Plásticos del Sur ${suffix}`);
    });

    it('no usa proveedores de otra empresa, ni siquiera con el mismo RUC o nombre', async () => {
      const res = await importar(tokenB, {
        simular: true,
        filas: [fila(n('ISO')), fila(n('ISO2'), { proveedor: 'Otro', proveedorTaxId: `1790${suffix}001` })],
      });
      expect(res.body.resumen).toMatchObject({ nuevas: 0, conErrores: 2 });
      expect((await listar(tokenB)).some((o) => o.numero === n('ISO'))).toBe(false);
    });
  });

  describe('mapeo de columnas por empresa', () => {
    const put = (token: string, tipo: string, mapeo: Record<string, unknown>) =>
      http().put(`/api/import-mappings/${tipo}`).set(auth(token)).send({ mapeo });
    const get = (token: string, tipo: string) => http().get(`/api/import-mappings/${tipo}`).set(auth(token));

    it('sin mapeo guardado devuelve null', async () => {
      const res = await get(tokenA, 'ordenes_compra');
      expect(res.status).toBe(200);
      expect(res.body.mapeo).toBeNull();
    });

    it('guarda el mapeo, descarta campos desconocidos y valores no válidos, y lo devuelve limpio', async () => {
      const res = await put(tokenA, 'ordenes_compra', {
        numero: 'Nro Pedido',
        sku: 'Código',
        cantidad: 'Cant.',
        hackeo: 'x',
        notas: 123,
        descripcion: '   ',
        proveedor: 'p'.repeat(200),
      });
      expect(res.status).toBe(200);
      expect(res.body.mapeo).toEqual({ numero: 'Nro Pedido', sku: 'Código', cantidad: 'Cant.' });
      expect((await get(tokenA, 'ordenes_compra')).body.mapeo).toEqual({ numero: 'Nro Pedido', sku: 'Código', cantidad: 'Cant.' });
    });

    it('guardar de nuevo reemplaza (un registro por tipo) y cada tipo es independiente', async () => {
      await put(tokenA, 'ordenes_compra', { numero: 'OC' });
      expect((await get(tokenA, 'ordenes_compra')).body.mapeo).toEqual({ numero: 'OC' });
      expect((await get(tokenA, 'politicas_inventario')).body.mapeo).toBeNull();
      expect((await put(tokenA, 'politicas_inventario', { sku: 'Ref', consumoDiario: 'Consumo/día' })).status).toBe(200);
    });

    it('rechaza tipos desconocidos y cuerpos inválidos (400)', async () => {
      expect((await get(tokenA, 'cualquiera')).status).toBe(400);
      expect((await put(tokenA, 'cualquiera', {})).status).toBe(400);
      expect((await http().put('/api/import-mappings/ordenes_compra').set(auth(tokenA)).send({ mapeo: 'no' })).status).toBe(400);
    });

    it('el mapeo es de cada empresa', async () => {
      expect((await get(tokenB, 'ordenes_compra')).body.mapeo).toBeNull();
    });
  });
});
