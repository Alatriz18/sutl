import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { DocumentExpiryMonitorService } from '../src/modules/documents/document-expiry-monitor.service';
import { createTestApp } from './test-app';
import { auth, crearTenantConAdmin, ENVIO_BASE, PASSWORD } from './test-helpers';

const DIA = 86_400_000;
const PDF = Buffer.from('%PDF-1.4 responsable');
const MAILPIT = process.env.MAILPIT_URL ?? 'http://localhost:8025';

// El aviso de vencimientos también llega al responsable de «documento faltante» que definió la empresa.
describe('Avisos de vencimiento al responsable (e2e)', () => {
  let app: INestApplication;
  const suffix = Date.now();
  const limiteLoginOriginal = process.env.LOGIN_RATE_LIMIT;
  let a: Awaited<ReturnType<typeof crearTenantConAdmin>>;
  let operador: { id: string; email: string };
  let envioId: string;
  const http = () => request(app.getHttpServer());
  const monitor = () => app.get(DocumentExpiryMonitorService);
  const en = (dias: number) => new Date(Date.now() + dias * DIA).toISOString();
  const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

  async function correosPara(email: string, cantidad: number, ms = 8000) {
    const limite = Date.now() + ms;
    let n = 0;
    while (Date.now() < limite) {
      const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
      n = (((await res.json()) as { messages: unknown[] }).messages ?? []).length;
      if (n >= cantidad) return n;
      await espera(150);
    }
    return n;
  }

  async function subirVencido(tipo: string) {
    const r = await http().post('/api/documents').set(auth(a.token)).field('shipmentId', envioId).field('tipo', tipo).field('fechaVencimiento', en(-1)).attach('file', PDF, `${tipo}.pdf`);
    expect(r.status).toBe(201);
  }

  beforeAll(async () => {
    process.env.LOGIN_RATE_LIMIT = '1000';
    process.env.SMTP_HOST ??= 'localhost';
    process.env.SMTP_PORT ??= '1025';
    process.env.SMTP_FROM ??= 'SUTL <notificaciones@sutl.local>';
    app = await createTestApp();
    a = await crearTenantConAdmin(app, `DocResp A ${suffix}`);
    const email = `docresp-op-${suffix}@e2e-test.com`;
    const op = await http().post('/api/users').set(auth(a.token)).send({ email, password: PASSWORD, nombre: 'Operador Docs', rol: 'operador' });
    expect(op.status).toBe(201);
    operador = { id: op.body.id, email };
    const e = await http().post('/api/shipments').set(auth(a.token)).send(ENVIO_BASE);
    envioId = e.body.id;
  });

  afterAll(async () => {
    process.env.LOGIN_RATE_LIMIT = limiteLoginOriginal;
    await app.close();
  });

  it('sin responsable definido, solo recibe el administrador', async () => {
    await subirVencido('factura');
    const r = await monitor().avisarEmpresa(a.tenantId);
    expect(r.correos).toBe(1);
    expect(await correosPara(operador.email, 1, 600)).toBe(0);
  });

  it('con responsable definido, recibe el aviso además del administrador', async () => {
    expect((await http().patch('/api/tenant-config').set(auth(a.token)).send({ configuracion: { excepciones: { responsableDocumentoFaltanteId: operador.id } } })).status).toBe(200);
    await subirVencido('packing_list');
    const r = await monitor().avisarEmpresa(a.tenantId);
    expect(r.correos).toBe(2);
    expect(await correosPara(operador.email, 1)).toBe(1);
  });

  it('si el responsable es también administrador, no recibe el correo duplicado', async () => {
    expect((await http().patch('/api/tenant-config').set(auth(a.token)).send({ configuracion: { excepciones: { responsableDocumentoFaltanteId: a.userId } } })).status).toBe(200);
    await subirVencido('bl');
    expect((await monitor().avisarEmpresa(a.tenantId)).correos).toBe(1);
  });

  it('si el responsable se desactiva, el aviso sigue llegando solo a los administradores', async () => {
    await http().patch('/api/tenant-config').set(auth(a.token)).send({ configuracion: { excepciones: { responsableDocumentoFaltanteId: operador.id } } });
    await app.get(PrismaService).user.update({ where: { id: operador.id }, data: { activo: false } });
    await subirVencido('pedimento');
    expect((await monitor().avisarEmpresa(a.tenantId)).correos).toBe(1);
  });
});
