import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';

// Utilidades compartidas por las pruebas e2e nuevas: crean empresas reales
// (vía super_admin) con un usuario administrador, igual que en producción.
const SUPER_ADMIN = { email: 'admin@sutl.dev', password: 'SutlAdmin2026!' };
export const PASSWORD = 'PasswordSeguro123';

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function loginAs(app: INestApplication, email: string, password = PASSWORD) {
  const res = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  return res.body.accessToken as string;
}

export async function superAdminToken(app: INestApplication) {
  return loginAs(app, SUPER_ADMIN.email, SUPER_ADMIN.password);
}

// Crea un tenant nuevo con un usuario admin_tenant (register crea operadores;
// el ascenso se hace directo en la base solo como preparación de la prueba).
export async function crearTenantConAdmin(app: INestApplication, nombre: string) {
  const sa = await superAdminToken(app);
  const http = () => request(app.getHttpServer());
  const tenant = await http().post('/api/tenants').set(auth(sa)).send({ nombre, plan: 'trial' });
  expect(tenant.status).toBe(201);
  const email = `${nombre.replace(/\W/g, '').toLowerCase()}@e2e-test.com`;
  const user = await http()
    .post('/api/auth/register')
    .set(auth(sa))
    .send({ tenantId: tenant.body.id, email, password: PASSWORD, nombre });
  expect(user.status).toBe(201);
  await app.get(PrismaService).user.update({ where: { id: user.body.id }, data: { rol: 'admin_tenant' } });
  return { tenantId: tenant.body.id as string, userId: user.body.id as string, email, token: await loginAs(app, email) };
}

export const ENVIO_BASE = {
  tipo: 'importacion',
  modo: 'maritimo',
  remitenteNombre: 'Proveedor',
  destinatarioNombre: 'Planta',
  origen: 'Shanghai',
  destino: 'Guayaquil',
};
