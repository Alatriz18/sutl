import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './test-app';
import { auth, crearTenantConAdmin, loginAs, PASSWORD, superAdminToken } from './test-helpers';

type OC = { id: string; numero: string };

// Roles B5. Analista de SUTL: trabaja en empresas clientes solo con permiso vigente
// (solo lectura por defecto, revocable al instante). Proveedor externo: ve únicamente
// sus órdenes emitidas y nada más.
describe('Roles analista_sutl y proveedor (e2e)', () => {
  let app: INestApplication;
  const suffix = Date.now();
  const limiteLoginOriginal = process.env.LOGIN_RATE_LIMIT;
  let sa: string;
  let a: Awaited<ReturnType<typeof crearTenantConAdmin>>;
  let b: Awaited<ReturnType<typeof crearTenantConAdmin>>;
  let analistaId: string;
  let analistaToken: string;
  let grantId: string;
  const http = () => request(app.getHttpServer());
  const prisma = () => app.get(PrismaService);

  async function crearOc(token: string, proveedorId: string, numero: string, estado: 'emitida' | 'borrador') {
    const oc = await http()
      .post('/api/purchase-orders')
      .set(auth(token))
      .send({ numero, proveedorId, lineas: [{ sku: `SKU-${numero}`, descripcion: 'Material', cantidad: 10, unidad: 'kg' }] });
    expect(oc.status).toBe(201);
    if (estado !== 'borrador') await prisma().purchaseOrder.update({ where: { id: oc.body.id }, data: { estado } });
    return oc.body.id as string;
  }

  beforeAll(async () => {
    process.env.LOGIN_RATE_LIMIT = '1000';
    app = await createTestApp();
    sa = await superAdminToken(app);
    a = await crearTenantConAdmin(app, `Roles A ${suffix}`);
    b = await crearTenantConAdmin(app, `Roles B ${suffix}`);

    const email = `analista-${suffix}@sutl-test.com`;
    const creado = await http().post('/api/users').set(auth(sa)).send({ email, password: PASSWORD, nombre: 'Analista SUTL', rol: 'analista_sutl' });
    expect(creado.status).toBe(201);
    analistaId = creado.body.id;
    analistaToken = await loginAs(app, email);
  });

  afterAll(async () => {
    process.env.LOGIN_RATE_LIMIT = limiteLoginOriginal;
    await app.close();
  });

  describe('analista de SUTL', () => {
    it('un administrador de empresa no puede crear analistas de SUTL', async () => {
      const r = await http().post('/api/users').set(auth(a.token)).send({ email: `x-${suffix}@a.com`, password: PASSWORD, nombre: 'X', rol: 'analista_sutl' });
      expect(r.status).toBe(403);
    });

    it('sin permiso no puede entrar a una empresa cliente', async () => {
      const r = await http().post('/api/auth/empresa-activa').set(auth(analistaToken)).send({ tenantId: a.tenantId });
      expect(r.status).toBe(403);
    });

    it('solo el super_admin otorga permisos', async () => {
      const r = await http().post('/api/analyst-grants').set(auth(a.token)).send({ analystId: analistaId, tenantId: a.tenantId });
      expect(r.status).toBe(403);
      const analista = await http().post('/api/analyst-grants').set(auth(analistaToken)).send({ analystId: analistaId, tenantId: a.tenantId });
      expect(analista.status).toBe(403);
    });

    it('con permiso de solo lectura ve la empresa pero no puede escribir', async () => {
      const g = await http().post('/api/analyst-grants').set(auth(sa)).send({ analystId: analistaId, tenantId: a.tenantId });
      expect(g.status).toBe(201);
      expect(g.body.soloLectura).toBe(true);
      grantId = g.body.id;

      const lista = await http().get('/api/auth/empresas').set(auth(analistaToken));
      expect(lista.status).toBe(200);
      expect((lista.body.empresas as { id: string }[]).map((e) => e.id)).toContain(a.tenantId);
      expect((lista.body.empresas as { id: string }[]).map((e) => e.id)).not.toContain(b.tenantId);

      const cambio = await http().post('/api/auth/empresa-activa').set(auth(analistaToken)).send({ tenantId: a.tenantId });
      expect(cambio.status).toBe(200);
      const token = cambio.body.accessToken as string;

      expect((await http().get('/api/purchase-orders').set(auth(token))).status).toBe(200);
      const escritura = await http().post('/api/partners').set(auth(token)).send({ tipo: 'proveedor', nombre: `No debería ${suffix}` });
      expect(escritura.status).toBe(403);
      expect(escritura.body.message).toContain('solo lectura');
    });

    it('no puede entrar a una empresa sin permiso aunque conozca su id', async () => {
      const r = await http().post('/api/auth/empresa-activa').set(auth(analistaToken)).send({ tenantId: b.tenantId });
      expect(r.status).toBe(403);
    });

    it('no puede hacer lo que solo hace un administrador (usuarios, configuración)', async () => {
      const cambio = await http().post('/api/auth/empresa-activa').set(auth(analistaToken)).send({ tenantId: a.tenantId });
      const token = cambio.body.accessToken as string;
      expect((await http().get('/api/users').set(auth(token))).status).toBe(403);
      expect((await http().patch('/api/tenant-config').set(auth(token)).send({ restablecer: true })).status).toBe(403);
    });

    it('el ingreso del analista queda en la bitácora de la empresa', async () => {
      const r = await http().get('/api/audit?limite=100').set(auth(a.token));
      expect(r.status).toBe(200);
      const acciones = (r.body as { accion: string }[]).map((x) => x.accion);
      expect(acciones).toEqual(expect.arrayContaining(['analista.acceso_otorgado', 'analista.ingreso_empresa']));
    });

    it('con permiso de gestión puede escribir en la empresa', async () => {
      await http().post('/api/analyst-grants').set(auth(sa)).send({ analystId: analistaId, tenantId: a.tenantId, soloLectura: false });
      const cambio = await http().post('/api/auth/empresa-activa').set(auth(analistaToken)).send({ tenantId: a.tenantId });
      const r = await http().post('/api/partners').set(auth(cambio.body.accessToken)).send({ tipo: 'proveedor', nombre: `Creado por analista ${suffix}` });
      expect(r.status).toBe(201);
      // Y deja de poder leer los datos de otra empresa con ese mismo token.
      const otra = await http().get(`/api/partners/${r.body.id}`).set(auth(b.token));
      expect(otra.status).toBe(404);
    });

    it('al revocar el permiso, el token que ya tenía deja de funcionar al instante', async () => {
      const cambio = await http().post('/api/auth/empresa-activa').set(auth(analistaToken)).send({ tenantId: a.tenantId });
      const token = cambio.body.accessToken as string;
      expect((await http().get('/api/purchase-orders').set(auth(token))).status).toBe(200);

      const rev = await http().delete(`/api/analyst-grants/${grantId}`).set(auth(sa));
      expect(rev.status).toBe(200);

      const despues = await http().get('/api/purchase-orders').set(auth(token));
      expect(despues.status).toBe(403);
      // Aun sin permiso puede volver a su empresa con la misma sesión.
      const vuelta = await http().post('/api/auth/empresa-activa').set(auth(token)).send({ tenantId: (await prisma().user.findUnique({ where: { id: analistaId } }))!.tenantId });
      expect(vuelta.status).toBe(200);
    });
  });

  describe('proveedor externo', () => {
    let tokenProveedor: string;
    let ocPropia: string;
    let ocAjena: string;
    let ocBorrador: string;

    beforeAll(async () => {
      const p1 = await http().post('/api/partners').set(auth(a.token)).send({ tipo: 'proveedor', nombre: `Proveedor 1 ${suffix}` });
      const p2 = await http().post('/api/partners').set(auth(a.token)).send({ tipo: 'proveedor', nombre: `Proveedor 2 ${suffix}` });
      expect(p1.status).toBe(201);
      ocPropia = await crearOc(a.token, p1.body.id, `OC-P1-${suffix}`, 'emitida');
      ocBorrador = await crearOc(a.token, p1.body.id, `OC-P1B-${suffix}`, 'borrador');
      ocAjena = await crearOc(a.token, p2.body.id, `OC-P2-${suffix}`, 'emitida');

      const email = `prov-${suffix}@prov-test.com`;
      const u = await http().post('/api/users').set(auth(a.token)).send({ email, password: PASSWORD, nombre: 'Usuario proveedor', rol: 'proveedor', partnerId: p1.body.id });
      expect(u.status).toBe(201);
      tokenProveedor = await loginAs(app, email);
    });

    it('crear un usuario proveedor exige el proveedor y que sea de la misma empresa', async () => {
      const sin = await http().post('/api/users').set(auth(a.token)).send({ email: `sin-${suffix}@p.com`, password: PASSWORD, nombre: 'S', rol: 'proveedor' });
      expect(sin.status).toBe(400);
      const ajeno = await http().post('/api/partners').set(auth(b.token)).send({ tipo: 'proveedor', nombre: `Prov de B ${suffix}` });
      const cruzado = await http().post('/api/users').set(auth(a.token)).send({ email: `cr-${suffix}@p.com`, password: PASSWORD, nombre: 'C', rol: 'proveedor', partnerId: ajeno.body.id });
      expect(cruzado.status).toBe(404);
    });

    it('ve solo sus órdenes emitidas', async () => {
      const r = await http().get('/api/purchase-orders').set(auth(tokenProveedor));
      expect(r.status).toBe(200);
      const ids = (r.body as OC[]).map((o) => o.id);
      expect(ids).toEqual([ocPropia]);
      expect(ids).not.toContain(ocAjena);
      expect(ids).not.toContain(ocBorrador);
    });

    it('no ve datos internos de la orden', async () => {
      const r = await http().get(`/api/purchase-orders/${ocPropia}`).set(auth(tokenProveedor));
      expect(r.status).toBe(200);
      expect(r.body).not.toHaveProperty('notas');
      expect(r.body).not.toHaveProperty('creadoPorId');
      expect(r.body.lineas[0]).not.toHaveProperty('recepciones');
    });

    it('la orden de otro proveedor o un borrador responden como si no existieran', async () => {
      expect((await http().get(`/api/purchase-orders/${ocAjena}`).set(auth(tokenProveedor))).status).toBe(404);
      expect((await http().get(`/api/purchase-orders/${ocBorrador}`).set(auth(tokenProveedor))).status).toBe(404);
    });

    it('un filtro por otro proveedor no le sirve para ver órdenes ajenas', async () => {
      const otro = await prisma().purchaseOrder.findUnique({ where: { id: ocAjena } });
      const r = await http().get(`/api/purchase-orders?proveedorId=${otro!.proveedorId}`).set(auth(tokenProveedor));
      expect(r.status).toBe(200);
      expect((r.body as OC[]).map((o) => o.id)).toEqual([ocPropia]);
    });

    it('no puede crear ni modificar órdenes', async () => {
      expect((await http().post('/api/purchase-orders').set(auth(tokenProveedor)).send({})).status).toBe(403);
      expect((await http().patch(`/api/purchase-orders/${ocPropia}`).set(auth(tokenProveedor)).send({ notas: 'x' })).status).toBe(403);
      expect((await http().post(`/api/purchase-orders/${ocPropia}/transicion`).set(auth(tokenProveedor)).send({ estado: 'confirmada' })).status).toBe(403);
    });

    it('todo lo demás le está vedado por defecto', async () => {
      for (const ruta of ['/api/shipments', '/api/users', '/api/documents', '/api/tasks', '/api/supply-risk', '/api/control-tower', '/api/audit', '/api/tenant-config', '/api/partners', '/api/carriers']) {
        const r = await http().get(ruta).set(auth(tokenProveedor));
        expect([ruta, r.status]).toEqual([ruta, 403]);
      }
    });

    it('sí puede usar la seguridad de su cuenta', async () => {
      expect((await http().get('/api/auth/mfa').set(auth(tokenProveedor))).status).toBe(200);
    });

    it('no se le puede asignar una tarea', async () => {
      const u = await prisma().user.findFirst({ where: { email: `prov-${suffix}@prov-test.com` } });
      const r = await http().post('/api/tasks').set(auth(a.token)).send({ titulo: 'Tarea', asignadoAId: u!.id });
      expect(r.status).toBe(400);
    });
  });
});
