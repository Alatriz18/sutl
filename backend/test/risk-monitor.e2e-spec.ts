import { INestApplication } from '@nestjs/common';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { RiskMonitorService } from '../src/modules/supply-risk/risk-monitor.service';
import { createTestApp } from './test-app';
import { auth, crearTenantConAdmin } from './test-helpers';

type Cambio = { sku: string; desde: string | null; hacia: string; accion: string; avisado?: boolean };

// Evaluación periódica del riesgo: historial de cambios de semáforo, aviso por
// correo cuando un SKU pasa a rojo (si la empresa lo quiere) y webhook.
describe('Monitor de riesgo de abastecimiento (e2e)', () => {
  let app: INestApplication;
  const suffix = Date.now();
  // SKU únicos por corrida: Mailpit conserva los correos de corridas anteriores.
  const VERDE = `MON-V${suffix}`;
  const ROJO = `MON-R${suffix}`;
  let a: Awaited<ReturnType<typeof crearTenantConAdmin>>;
  let b: Awaited<ReturnType<typeof crearTenantConAdmin>>;
  let bodega: string;
  let receptor: Server;
  let recibidos: { evento: string; datos: Record<string, unknown> }[] = [];
  const MAILPIT = process.env.MAILPIT_URL ?? 'http://localhost:8025';
  const limiteLoginOriginal = process.env.LOGIN_RATE_LIMIT;

  const http = () => request(app.getHttpServer());
  const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const evaluar = async (token: string) => (await http().post('/api/supply-risk/evaluar').set(auth(token))).body.cambios as Cambio[];
  const historial = async (token: string) => (await http().get('/api/supply-risk/cambios').set(auth(token))).body as Cambio[];

  async function sku(token: string, codigo: string, stock: number, consumoDiario: number, leadTimeDias?: number) {
    expect((await http().post('/api/inventory-items').set(auth(token)).send({ warehouseId: bodega, sku: codigo, descripcion: codigo, cantidad: stock, unidad: 'kg' })).status).toBe(201);
    expect((await http().put('/api/inventory-policies').set(auth(token)).send({ sku: codigo, consumoDiario, ...(leadTimeDias ? { leadTimeDias } : {}) })).status).toBe(200);
  }

  async function correos(asunto: string) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`subject:"${asunto}"`)}`);
    return ((await res.json()) as { messages: { To: { Address: string }[] }[] }).messages;
  }

  async function esperarCorreos(asunto: string, cantidad: number, ms = 8000) {
    const limite = Date.now() + ms;
    while (Date.now() < limite) {
      const m = await correos(asunto);
      if (m.length >= cantidad) return m;
      await espera(150);
    }
    return correos(asunto);
  }

  beforeAll(async () => {
    process.env.LOGIN_RATE_LIMIT = '1000';
    process.env.SMTP_HOST ??= 'localhost';
    process.env.SMTP_PORT ??= '1025';
    process.env.SMTP_FROM ??= 'SUTL <notificaciones@sutl.local>';
    receptor = createServer((req, res) => {
      let cuerpo = '';
      req.on('data', (c) => (cuerpo += c));
      req.on('end', () => {
        const j = JSON.parse(cuerpo);
        recibidos.push({ evento: j.evento, datos: j.datos });
        res.writeHead(200);
        res.end();
      });
    });
    await new Promise<void>((ok) => receptor.listen(0, '127.0.0.1', ok));

    app = await createTestApp();
    a = await crearTenantConAdmin(app, `MonA${suffix}`);
    b = await crearTenantConAdmin(app, `MonB${suffix}`);
    bodega = (await http().post('/api/warehouses').set(auth(a.token)).send({ nombre: 'Bodega' })).body.id;
  });

  afterAll(async () => {
    process.env.LOGIN_RATE_LIMIT = limiteLoginOriginal;
    await app.close();
    await new Promise((r) => receptor.close(r));
  });

  it('sin sesión recibe 401', async () => {
    expect((await http().post('/api/supply-risk/evaluar')).status).toBe(401);
    expect((await http().get('/api/supply-risk/cambios')).status).toBe(401);
  });

  it('sin SKU no hay cambios ni historial', async () => {
    expect(await evaluar(a.token)).toEqual([]);
    expect(await historial(a.token)).toEqual([]);
  });

  it('la primera evaluación registra el estado de cada SKU; repetirla no duplica nada', async () => {
    await sku(a.token, VERDE, 100000, 100);
    await sku(a.token, ROJO, 500, 100, 30);
    const primera = await evaluar(a.token);
    expect(primera.map((c) => [c.sku, c.desde, c.hacia]).sort()).toEqual([
      [ROJO, null, 'rojo'],
      [VERDE, null, 'verde'],
    ]);
    expect(await evaluar(a.token)).toEqual([]);
    expect(await historial(a.token)).toHaveLength(2);
  });

  it('un SKU que pasa a rojo queda en el historial y avisa por correo a los administradores', async () => {
    const asunto = `SUTL: ${VERDE} está en rojo`;
    // El consumo se dispara: 100.000 de stock ahora duran 1 día y el proveedor tarda 30.
    expect((await http().put('/api/inventory-policies').set(auth(a.token)).send({ sku: VERDE, consumoDiario: 100000, leadTimeDias: 30 })).status).toBe(200);
    const cambios = await evaluar(a.token);
    expect(cambios).toEqual([expect.objectContaining({ sku: VERDE, desde: 'verde', hacia: 'rojo', accion: 'compra_urgente' })]);

    const mails = await esperarCorreos(asunto, 1);
    expect(mails).toHaveLength(1);
    expect(mails[0].To[0].Address).toBe(a.email);
    const h = await historial(a.token);
    expect(h[0]).toMatchObject({ sku: VERDE, desde: 'verde', hacia: 'rojo', avisado: true });
  });

  it('si la empresa desactiva el aviso, el cambio se registra pero no se envía correo', async () => {
    const asunto = `SUTL: ${VERDE} está en rojo`;
    // Vuelve a verde y luego a rojo, ahora con el aviso apagado.
    await http().put('/api/inventory-policies').set(auth(a.token)).send({ sku: VERDE, consumoDiario: 100 });
    expect((await evaluar(a.token))[0]).toMatchObject({ desde: 'rojo', hacia: 'verde' });
    const antes = (await correos(asunto)).length;

    const cfg = await http().patch('/api/tenant-config').set(auth(a.token)).send({ configuracion: { riesgo: { avisarAlPasarARojo: false } } });
    expect(cfg.status).toBe(200);
    expect(cfg.body.configuracion.riesgo.avisarAlPasarARojo).toBe(false);

    await http().put('/api/inventory-policies').set(auth(a.token)).send({ sku: VERDE, consumoDiario: 100000, leadTimeDias: 30 });
    expect((await evaluar(a.token))[0]).toMatchObject({ desde: 'verde', hacia: 'rojo' });
    await espera(600);
    expect((await correos(asunto)).length).toBe(antes);
    expect((await historial(a.token))[0]).toMatchObject({ hacia: 'rojo', avisado: false });
  });

  it('un webhook suscrito recibe riesgo.semaforo_cambiado', async () => {
    recibidos = [];
    const w = await http().post('/api/webhooks').set(auth(a.token)).send({
      url: `http://127.0.0.1:${(receptor.address() as AddressInfo).port}/hook`,
      eventos: ['riesgo.semaforo_cambiado'],
    });
    expect(w.status).toBe(201);
    await http().put('/api/inventory-policies').set(auth(a.token)).send({ sku: VERDE, consumoDiario: 100 });
    await evaluar(a.token); // rojo → verde
    const limite = Date.now() + 8000;
    while (recibidos.length === 0 && Date.now() < limite) await espera(100);
    expect(recibidos[0]).toMatchObject({ evento: 'riesgo.semaforo_cambiado', datos: { sku: VERDE, desde: 'rojo', hacia: 'verde' } });
  });

  it('evaluarTodas (la ronda programada) recorre las empresas con SKU sin romperse', async () => {
    const r = await app.get(RiskMonitorService).evaluarTodas();
    expect(r.empresas).toBeGreaterThanOrEqual(1);
  });

  it('dos evaluaciones simultáneas no duplican el cambio', async () => {
    await http().put('/api/inventory-policies').set(auth(a.token)).send({ sku: VERDE, consumoDiario: 100000, leadTimeDias: 30 });
    const [x, y] = await Promise.all([evaluar(a.token), evaluar(a.token)]);
    expect(x.length + y.length).toBe(1);
    const filas = await app.get(PrismaService).riskChange.count({ where: { tenantId: a.tenantId, sku: VERDE, desde: 'verde', hacia: 'rojo' } });
    expect(filas).toBe(3); // la tercera vez que pasa a rojo, sin repetirse
  });

  it('aislamiento: otra empresa no ve el historial de A ni lo altera', async () => {
    expect(await historial(b.token)).toEqual([]);
    expect(await evaluar(b.token)).toEqual([]);
    expect((await historial(a.token)).length).toBeGreaterThan(0);
  });
});
