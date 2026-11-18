import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { codigoParaPaso, paso } from '../src/common/totp';
import { createTestApp } from './test-app';
import { auth, crearTenantConAdmin, loginAs, PASSWORD, superAdminToken } from './test-helpers';

// Segundo factor obligatorio: cada empresa puede exigirlo a sus administradores y el personal de SUTL lo
// necesita siempre en producción. Quien lo debe tener y no lo activó solo puede ir a activarlo.
describe('Segundo factor obligatorio (e2e)', () => {
  let app: INestApplication;
  const suffix = Date.now();
  const limiteLoginOriginal = process.env.LOGIN_RATE_LIMIT;
  const personalOriginal = process.env.MFA_OBLIGATORIO_PERSONAL_SUTL;
  let a: Awaited<ReturnType<typeof crearTenantConAdmin>>;
  let b: Awaited<ReturnType<typeof crearTenantConAdmin>>;
  const http = () => request(app.getHttpServer());

  async function crearUsuario(token: string, rol: string, etiqueta: string) {
    const email = `${etiqueta}-${suffix}@mfa-oblig.com`;
    const r = await http().post('/api/users').set(auth(token)).send({ email, password: PASSWORD, nombre: etiqueta, rol });
    expect(r.status).toBe(201);
    return { email, userId: r.body.id as string, token: await loginAs(app, email) };
  }

  // Activa el segundo factor de quien tiene ese token (pasos 1 y 2 del flujo real).
  async function activarMfa(token: string) {
    const ini = await http().post('/api/auth/mfa/iniciar').set(auth(token));
    expect(ini.status).toBe(201);
    const act = await http().post('/api/auth/mfa/activar').set(auth(token)).send({ codigo: codigoParaPaso(ini.body.secreto, paso()) });
    expect(act.status).toBe(200);
  }

  const exigir = (token: string, valor: boolean) =>
    http().patch('/api/tenant-config').set(auth(token)).send({ configuracion: { seguridad: { exigirMfaAdministradores: valor } } });

  beforeAll(async () => {
    process.env.LOGIN_RATE_LIMIT = '1000';
    process.env.MFA_OBLIGATORIO_PERSONAL_SUTL = 'false';
    app = await createTestApp();
    a = await crearTenantConAdmin(app, `MfaOblig A ${suffix}`);
    b = await crearTenantConAdmin(app, `MfaOblig B ${suffix}`);
  });

  afterAll(async () => {
    process.env.LOGIN_RATE_LIMIT = limiteLoginOriginal;
    if (personalOriginal === undefined) delete process.env.MFA_OBLIGATORIO_PERSONAL_SUTL;
    else process.env.MFA_OBLIGATORIO_PERSONAL_SUTL = personalOriginal;
    await app.close();
  });

  it('por defecto no se exige: un administrador sin segundo factor trabaja como siempre', async () => {
    expect((await http().get('/api/tenant-config').set(auth(a.token))).body.configuracion.seguridad).toEqual({ exigirMfaAdministradores: false });
    const e = await http().get('/api/auth/mfa').set(auth(a.token));
    expect(e.body).toMatchObject({ activo: false, obligatorio: false });
    expect((await http().get('/api/shipments').set(auth(a.token))).status).toBe(200);
  });

  it('no se puede exigir el segundo factor sin tenerlo uno mismo (no dejar a la empresa afuera)', async () => {
    const r = await exigir(a.token, true);
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.body)).toContain('propio segundo factor');
    expect((await http().get('/api/tenant-config').set(auth(a.token))).body.configuracion.seguridad.exigirMfaAdministradores).toBe(false);
  });

  it('un valor que no es booleano se rechaza', async () => {
    expect((await http().patch('/api/tenant-config').set(auth(a.token)).send({ configuracion: { seguridad: { exigirMfaAdministradores: 'si' } } })).status).toBe(400);
  });

  describe('con la política activada', () => {
    let segundoAdmin: { email: string; userId: string; token: string };
    let operador: { token: string };

    beforeAll(async () => {
      segundoAdmin = await crearUsuario(a.token, 'admin_tenant', 'segundo-admin');
      operador = await crearUsuario(a.token, 'operador', 'operador');
      await activarMfa(a.token);
      expect((await exigir(a.token, true)).status).toBe(200);
    });

    it('quien ya tiene el segundo factor sigue trabajando', async () => {
      expect((await http().get('/api/shipments').set(auth(a.token))).status).toBe(200);
      expect((await http().get('/api/auth/mfa').set(auth(a.token))).body).toMatchObject({ activo: true, obligatorio: true });
    });

    it('un administrador sin segundo factor queda bloqueado en todo, con un código que el frontend reconoce', async () => {
      for (const ruta of ['/api/shipments', '/api/tenant-config', '/api/users', '/api/analytics/resumen']) {
        const r = await http().get(ruta).set(auth(segundoAdmin.token));
        expect(r.status).toBe(403);
        expect(r.body.code).toBe('MFA_REQUERIDO');
      }
      expect((await http().post('/api/shipments').set(auth(segundoAdmin.token)).send({})).status).toBe(403);
    });

    it('pero puede ver su estado y activar el segundo factor; al activarlo recupera el acceso', async () => {
      expect((await http().get('/api/auth/mfa').set(auth(segundoAdmin.token))).body).toMatchObject({ activo: false, obligatorio: true });
      await activarMfa(segundoAdmin.token);
      expect((await http().get('/api/shipments').set(auth(segundoAdmin.token))).status).toBe(200);
    });

    it('restablecer el segundo factor de un administrador lo vuelve a bloquear hasta que lo active otra vez', async () => {
      const r = await http().post(`/api/auth/mfa/restablecer/${segundoAdmin.userId}`).set(auth(a.token));
      expect(r.status).toBe(200);
      const nuevo = await loginAs(app, segundoAdmin.email);
      expect((await http().get('/api/shipments').set(auth(nuevo))).status).toBe(403);
    });

    it('no afecta a los operadores ni a otras empresas', async () => {
      expect((await http().get('/api/shipments').set(auth(operador.token))).status).toBe(200);
      expect((await http().get('/api/shipments').set(auth(b.token))).status).toBe(200);
      expect((await http().get('/api/tenant-config').set(auth(b.token))).body.configuracion.seguridad.exigirMfaAdministradores).toBe(false);
    });

    it('un administrador sin segundo factor no puede quitar la exigencia ni cambiar nada', async () => {
      const sin = await loginAs(app, segundoAdmin.email);
      expect((await exigir(sin, false)).status).toBe(403);
      expect((await http().get('/api/tenant-config').set(auth(a.token))).body.configuracion.seguridad.exigirMfaAdministradores).toBe(true);
    });

    it('el administrador con segundo factor puede dejar de exigirlo', async () => {
      expect((await exigir(a.token, false)).status).toBe(200);
      const sin = await loginAs(app, segundoAdmin.email);
      expect((await http().get('/api/shipments').set(auth(sin))).status).toBe(200);
    });
  });

  describe('personal de SUTL', () => {
    it('un analista sin segundo factor queda bloqueado cuando es obligatorio, y puede activarlo', async () => {
      const sa = await superAdminToken(app);
      const analista = await crearUsuario(sa, 'analista_sutl', 'analista');
      // Fuera de producción, sin la variable, no se exige.
      expect((await http().get('/api/auth/empresas').set(auth(analista.token))).status).toBe(200);

      process.env.MFA_OBLIGATORIO_PERSONAL_SUTL = 'true';
      try {
        const bloqueado = await http().get('/api/auth/empresas').set(auth(analista.token));
        expect(bloqueado.status).toBe(403);
        expect(bloqueado.body.code).toBe('MFA_REQUERIDO');
        await activarMfa(analista.token);
        expect((await http().get('/api/auth/empresas').set(auth(analista.token))).status).toBe(200);
        // El super administrador sin segundo factor tampoco puede aprovisionar empresas.
        const r = await http().post('/api/tenants').set(auth(sa)).send({ nombre: `Sin MFA ${suffix}`, plan: 'trial' });
        expect(r.status).toBe(403);
        expect(r.body.code).toBe('MFA_REQUERIDO');
      } finally {
        process.env.MFA_OBLIGATORIO_PERSONAL_SUTL = 'false';
      }
    });
  });
});
