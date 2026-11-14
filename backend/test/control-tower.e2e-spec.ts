import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './test-app';
import { auth, crearTenantConAdmin } from './test-helpers';

// Torre de control: junta lo que requiere atención y nunca cruza empresas.
describe('Torre de control (e2e)', () => {
  let app: INestApplication;
  const suffix = Date.now();
  const limiteLoginOriginal = process.env.LOGIN_RATE_LIMIT;
  let a: Awaited<ReturnType<typeof crearTenantConAdmin>>;
  let b: Awaited<ReturnType<typeof crearTenantConAdmin>>;
  let ocId: string;
  const http = () => request(app.getHttpServer());
  const prisma = () => app.get(PrismaService);

  beforeAll(async () => {
    process.env.LOGIN_RATE_LIMIT = '1000';
    app = await createTestApp();
    a = await crearTenantConAdmin(app, `Torre A ${suffix}`);
    b = await crearTenantConAdmin(app, `Torre B ${suffix}`);

    const proveedor = await http().post('/api/partners').set(auth(a.token)).send({ tipo: 'proveedor', nombre: `Prov ${suffix}` });
    expect(proveedor.status).toBe(201);
    const oc = await http()
      .post('/api/purchase-orders')
      .set(auth(a.token))
      .send({ numero: `OC-TW-${suffix}`, proveedorId: proveedor.body.id, lineas: [{ sku: `TW-${suffix}`, descripcion: 'Material', cantidad: 10, unidad: 'kg' }] });
    expect(oc.status).toBe(201);
    ocId = oc.body.id;
    await prisma().purchaseOrder.update({ where: { id: ocId }, data: { estado: 'emitida', fechaRequerida: new Date(Date.now() - 2 * 86400000) } });
  });

  afterAll(async () => {
    process.env.LOGIN_RATE_LIMIT = limiteLoginOriginal;
    await app.close();
  });

  it('exige sesión', async () => {
    expect((await http().get('/api/control-tower')).status).toBe(401);
  });

  it('muestra la OC atrasada de la empresa con sus días de atraso', async () => {
    const r = await http().get('/api/control-tower').set(auth(a.token));
    expect(r.status).toBe(200);
    expect(r.body.ocsAtrasadas.total).toBeGreaterThanOrEqual(1);
    const oc = r.body.ocsAtrasadas.items.find((o: { id: string }) => o.id === ocId);
    expect(oc).toMatchObject({ numero: `OC-TW-${suffix}`, diasAtraso: 2 });
    expect(r.body.riesgo.resumen).toEqual(expect.objectContaining({ rojo: expect.any(Number), amarillo: expect.any(Number) }));
    expect(r.body.excepciones).toEqual(expect.objectContaining({ abiertas: expect.any(Number), criticas: expect.any(Number) }));
  });

  it('otra empresa no ve nada de esto', async () => {
    const r = await http().get('/api/control-tower').set(auth(b.token));
    expect(r.status).toBe(200);
    expect(r.body.ocsAtrasadas.total).toBe(0);
    expect(r.body.ocsAtrasadas.items).toEqual([]);
    expect(r.body.tareas.misTareasHoy).toEqual([]);
  });
});
