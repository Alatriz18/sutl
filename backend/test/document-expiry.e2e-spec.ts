import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DocumentExpiryMonitorService } from '../src/modules/documents/document-expiry-monitor.service';
import { createTestApp } from './test-app';
import { auth, crearTenantConAdmin, ENVIO_BASE } from './test-helpers';

const DIA = 86_400_000;
const PDF = Buffer.from('%PDF-1.4 vencimiento');
const MAILPIT = process.env.MAILPIT_URL ?? 'http://localhost:8025';

// Avisos por correo de documentos por vencer o vencidos: un solo correo por administrador, una sola vez por
// documento y estado, y la empresa puede apagarlos.
describe('Avisos de vencimiento de documentos (e2e)', () => {
  let app: INestApplication;
  const suffix = Date.now();
  const limiteLoginOriginal = process.env.LOGIN_RATE_LIMIT;
  let a: Awaited<ReturnType<typeof crearTenantConAdmin>>;
  let b: Awaited<ReturnType<typeof crearTenantConAdmin>>;
  let envioA: { id: string; codigoGuia: string };
  const http = () => request(app.getHttpServer());
  const monitor = () => app.get(DocumentExpiryMonitorService);
  const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const en = (dias: number) => new Date(Date.now() + dias * DIA).toISOString();

  async function subir(token: string, shipmentId: string, tipo: string, vence: string) {
    const r = await http().post('/api/documents').set(auth(token)).field('shipmentId', shipmentId).field('tipo', tipo).field('fechaVencimiento', vence).attach('file', PDF, `${tipo}.pdf`);
    expect(r.status).toBe(201);
    return r.body.id as string;
  }

  async function correosPara(email: string, cantidad: number, ms = 8000) {
    const limite = Date.now() + ms;
    let mensajes: { ID: string; Subject: string }[] = [];
    while (Date.now() < limite) {
      const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
      mensajes = ((await res.json()) as { messages: { ID: string; Subject: string }[] }).messages ?? [];
      if (mensajes.length >= cantidad) return mensajes;
      await espera(150);
    }
    return mensajes;
  }

  beforeAll(async () => {
    process.env.LOGIN_RATE_LIMIT = '1000';
    process.env.SMTP_HOST ??= 'localhost';
    process.env.SMTP_PORT ??= '1025';
    process.env.SMTP_FROM ??= 'SUTL <notificaciones@sutl.local>';
    app = await createTestApp();
    a = await crearTenantConAdmin(app, `DocVence A ${suffix}`);
    b = await crearTenantConAdmin(app, `DocVence B ${suffix}`);
    const e = await http().post('/api/shipments').set(auth(a.token)).send(ENVIO_BASE);
    expect(e.status).toBe(201);
    envioA = e.body;
    // Uno por vencer, uno ya vencido y uno lejano; en la otra empresa, uno vencido que no debe mezclarse.
    await subir(a.token, envioA.id, 'factura', en(5));
    await subir(a.token, envioA.id, 'packing_list', en(-1));
    await subir(a.token, envioA.id, 'otro', en(200));
    const eb = await http().post('/api/shipments').set(auth(b.token)).send(ENVIO_BASE);
    await subir(b.token, eb.body.id, 'factura', en(-3));
  });

  afterAll(async () => {
    process.env.LOGIN_RATE_LIMIT = limiteLoginOriginal;
    await app.close();
  });

  it('avisa una vez de lo vencido y lo por vencer, en un solo correo al administrador', async () => {
    const r = await monitor().avisarEmpresa(a.tenantId);
    expect(r).toEqual({ porVencer: 1, vencidos: 1, correos: 1 });
    const correos = await correosPara(a.email, 1);
    expect(correos).toHaveLength(1);
    expect(correos[0].Subject).toContain('1 documento(s) vencido(s) y 1 por vencer');
    const detalle = (await (await fetch(`${MAILPIT}/api/v1/message/${correos[0].ID}`)).json()) as { Text: string };
    expect(detalle.Text).toContain(envioA.codigoGuia);
    expect(detalle.Text).toContain('Factura');
    expect(detalle.Text).toContain('Lista de empaque');
    expect(detalle.Text).not.toContain('Otro documento'); // el lejano no se avisa
  });

  it('no repite el aviso en la siguiente ronda', async () => {
    expect(await monitor().avisarEmpresa(a.tenantId)).toEqual({ porVencer: 0, vencidos: 0, correos: 0 });
    await espera(500);
    expect(await correosPara(a.email, 1, 500)).toHaveLength(1);
  });

  it('cuando un documento por vencer ya venció, se avisa de nuevo como vencido (una vez)', async () => {
    // Un documento nuevo por vencer; luego «pasa el tiempo» (se evalúa con una fecha futura).
    await subir(a.token, envioA.id, 'bl', en(10));
    expect((await monitor().avisarEmpresa(a.tenantId)).porVencer).toBe(1);
    const dentroDeDosSemanas = new Date(Date.now() + 14 * DIA);
    const r = await monitor().avisarEmpresa(a.tenantId, dentroDeDosSemanas);
    expect(r.vencidos).toBeGreaterThanOrEqual(1);
    expect((await monitor().avisarEmpresa(a.tenantId, dentroDeDosSemanas)).vencidos).toBe(0);
  });

  it('las empresas no se mezclan', async () => {
    const r = await monitor().avisarEmpresa(b.tenantId);
    expect(r).toEqual({ porVencer: 0, vencidos: 1, correos: 1 });
    const correosB = await correosPara(b.email, 1);
    expect(correosB.length).toBeGreaterThanOrEqual(1);
    const detalle = (await (await fetch(`${MAILPIT}/api/v1/message/${correosB[0].ID}`)).json()) as { Text: string };
    expect(detalle.Text).not.toContain(envioA.codigoGuia);
  });

  it('la empresa puede apagar los avisos y, al volver a encenderlos, se avisa lo pendiente', async () => {
    const e = await http().post('/api/shipments').set(auth(a.token)).send(ENVIO_BASE);
    await subir(a.token, e.body.id, 'pedimento', en(3));
    const apagar = await http().patch('/api/tenant-config').set(auth(a.token)).send({ configuracion: { documentos: { avisarVencimientos: false } } });
    expect(apagar.status).toBe(200);
    expect(await monitor().avisarEmpresa(a.tenantId)).toEqual({ porVencer: 0, vencidos: 0, correos: 0 });
    await http().patch('/api/tenant-config').set(auth(a.token)).send({ configuracion: { documentos: { avisarVencimientos: true } } });
    const r = await monitor().avisarEmpresa(a.tenantId);
    expect(r.porVencer).toBe(1);
  });

  it('la ronda de todas las empresas no falla y devuelve totales', async () => {
    const r = await monitor().avisarTodas();
    expect(r.empresas).toBeGreaterThanOrEqual(2);
    expect(typeof r.correos).toBe('number');
  });

  it('un valor que no es booleano en la configuración se rechaza', async () => {
    expect((await http().patch('/api/tenant-config').set(auth(a.token)).send({ configuracion: { documentos: { avisarVencimientos: 'si' } } })).status).toBe(400);
  });
});
