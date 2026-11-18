import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './test-app';
import { auth, crearTenantConAdmin, ENVIO_BASE, superAdminToken } from './test-helpers';

const PROHIBIDOS = ['password', 'mfaSecret', 'refreshTokenHash', 'codeHash', 'keyHash', 'secreto'];
// Todas las rutas de listado (GET) de la API que un administrador puede abrir.
const LISTADOS = [
  '/api/alerts', '/api/analyst-grants', '/api/api-keys', '/api/audit', '/api/bookings', '/api/carriers', '/api/containers', '/api/contracts',
  '/api/documents', '/api/exceptions', '/api/import-mappings', '/api/invoices', '/api/notifications', '/api/partners', '/api/purchase-orders',
  '/api/quotes', '/api/rates', '/api/reports', '/api/shipments', '/api/supply-risk/cambios', '/api/tasks', '/api/tenant-config', '/api/tenants',
  '/api/users', '/api/webhooks', '/api/auth/mfa', '/api/control-tower', '/api/analytics/resumen',
];

// Red de seguridad: ninguna respuesta de la API devuelve contraseñas, hashes ni secretos de nadie.
describe('Las respuestas no contienen secretos (e2e)', () => {
  let app: INestApplication;
  const suffix = Date.now();
  const limiteLoginOriginal = process.env.LOGIN_RATE_LIMIT;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    process.env.LOGIN_RATE_LIMIT = '1000';
    app = await createTestApp();
  });

  afterAll(async () => {
    process.env.LOGIN_RATE_LIMIT = limiteLoginOriginal;
    await app.close();
  });

  const claves = (valor: unknown): string[] => (valor && typeof valor === 'object' ? Object.entries(valor as object).flatMap(([k, v]) => [k, ...claves(v)]) : []);

  it('un administrador con datos reales y el super administrador no ven secretos en ningún listado', async () => {
    const a = await crearTenantConAdmin(app, `SinSecretos ${suffix}`);
    // Algo de actividad para que los listados traigan filas con sus relaciones.
    const envio = await http().post('/api/shipments').set(auth(a.token)).send(ENVIO_BASE);
    await http().post('/api/documents').set(auth(a.token)).field('shipmentId', envio.body.id).field('tipo', 'factura').attach('file', Buffer.from('%PDF-1.4 x'), 'f.pdf');
    await http().post('/api/tasks').set(auth(a.token)).send({ titulo: 'Tarea de prueba', entidadTipo: 'envio', entidadId: envio.body.id });
    await http().post('/api/partners').set(auth(a.token)).send({ tipo: 'proveedor', nombre: `Prov ${suffix}` });
    const sa = await superAdminToken(app);

    const hallazgos: string[] = [];
    let respondieron = 0;
    for (const [rol, token] of [['admin', a.token], ['super_admin', sa]] as const) {
      for (const ruta of LISTADOS) {
        const r = await http().get(ruta).set(auth(token));
        if (r.status !== 200) continue;
        respondieron++;
        const texto = JSON.stringify(r.body);
        for (const k of claves(r.body)) if (PROHIBIDOS.includes(k)) hallazgos.push(`${rol} ${ruta}: clave «${k}»`);
        if (/\$2[aby]\$\d\d\$/.test(texto)) hallazgos.push(`${rol} ${ruta}: hash de bcrypt`);
      }
    }
    expect(respondieron).toBeGreaterThan(30);
    expect(hallazgos).toEqual([]);
  });
});
