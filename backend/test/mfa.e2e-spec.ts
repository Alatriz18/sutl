import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { codigoParaPaso, paso } from '../src/common/totp';
import { createTestApp } from './test-app';
import { auth, crearTenantConAdmin, loginAs, PASSWORD } from './test-helpers';

// Segundo factor (TOTP): activar, entrar con código, no reutilizar un código,
// códigos de recuperación, bloqueo por fallos y restablecimiento por el administrador.
describe('Segundo factor de autenticación (e2e)', () => {
  let app: INestApplication;
  const suffix = Date.now();
  const limiteLoginOriginal = process.env.LOGIN_RATE_LIMIT;
  let a: Awaited<ReturnType<typeof crearTenantConAdmin>>;
  let b: Awaited<ReturnType<typeof crearTenantConAdmin>>;
  let operador: { userId: string; email: string; token: string };
  let secreto: string;
  let recuperacion: string[];
  const http = () => request(app.getHttpServer());
  const prisma = () => app.get(PrismaService);
  const entrar = (email: string, codigo?: string, password = PASSWORD) => http().post('/api/auth/login').send({ email, password, ...(codigo ? { codigo } : {}) });
  // Sin esperar 30 s entre pruebas: se libera el "código ya usado" y los fallos directamente en la base.
  const liberar = () => prisma().user.update({ where: { id: operador.userId }, data: { mfaLastStep: null, mfaFailures: 0, mfaLockedUntil: null } });

  beforeAll(async () => {
    process.env.LOGIN_RATE_LIMIT = '1000';
    app = await createTestApp();
    a = await crearTenantConAdmin(app, `Mfa A ${suffix}`);
    b = await crearTenantConAdmin(app, `Mfa B ${suffix}`);
    const email = `op-mfa-${suffix}@e2e-test.com`;
    const r = await http().post('/api/users').set(auth(a.token)).send({ email, password: PASSWORD, nombre: 'Operador MFA', rol: 'operador' });
    expect(r.status).toBe(201);
    operador = { userId: r.body.id, email, token: await loginAs(app, email) };
  });

  afterAll(async () => {
    process.env.LOGIN_RATE_LIMIT = limiteLoginOriginal;
    await app.close();
  });

  it('sin segundo factor el ingreso funciona como siempre', async () => {
    const r = await entrar(operador.email);
    expect(r.status).toBe(200);
    expect(r.body.accessToken).toBeTruthy();
    const e = await http().get('/api/auth/mfa').set(auth(operador.token));
    expect(e.body).toMatchObject({ activo: false, codigosDeRecuperacionRestantes: 0 });
  });

  it('exige sesión', async () => {
    expect((await http().get('/api/auth/mfa')).status).toBe(401);
    expect((await http().post('/api/auth/mfa/iniciar')).status).toBe(401);
  });

  it('activar sin haber iniciado, o con un código equivocado, no activa nada', async () => {
    expect((await http().post('/api/auth/mfa/activar').set(auth(operador.token)).send({ codigo: '123456' })).status).toBe(409);
    const ini = await http().post('/api/auth/mfa/iniciar').set(auth(operador.token));
    expect(ini.status).toBe(201);
    expect(ini.body.otpauthUrl).toContain('otpauth://totp/');
    secreto = ini.body.secreto;
    expect((await http().post('/api/auth/mfa/activar').set(auth(operador.token)).send({ codigo: '000000' })).status).toBe(401);
    expect((await http().get('/api/auth/mfa').set(auth(operador.token))).body.activo).toBe(false);
  });

  it('el secreto se guarda cifrado en la base', async () => {
    const u = await prisma().user.findUniqueOrThrow({ where: { id: operador.userId }, select: { mfaSecret: true } });
    expect(u.mfaSecret?.startsWith('v1:')).toBe(true);
    expect(u.mfaSecret).not.toContain(secreto);
  });

  it('activar con el código de la app entrega 10 códigos de recuperación', async () => {
    const r = await http().post('/api/auth/mfa/activar').set(auth(operador.token)).send({ codigo: codigoParaPaso(secreto, paso()) });
    expect(r.status).toBe(200);
    expect(r.body.codigosDeRecuperacion).toHaveLength(10);
    recuperacion = r.body.codigosDeRecuperacion;
    expect((await http().get('/api/auth/mfa').set(auth(operador.token))).body).toMatchObject({ activo: true, codigosDeRecuperacionRestantes: 10 });
    expect((await http().post('/api/auth/mfa/iniciar').set(auth(operador.token))).status).toBe(409);
  });

  it('con segundo factor activo, la contraseña sola no da acceso: pide el código y no entrega tokens', async () => {
    const r = await entrar(operador.email);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ mfaRequerido: true });
    expect(r.headers['set-cookie']).toBeUndefined();
  });

  it('la contraseña incorrecta sigue dando el mismo error y no revela el segundo factor', async () => {
    const r = await entrar(operador.email, undefined, 'Incorrecta999');
    expect(r.status).toBe(401);
    expect(r.body.message).toBe('Credenciales inválidas');
  });

  it('con contraseña y código correctos entra; el mismo código no sirve una segunda vez', async () => {
    await liberar();
    const codigo = codigoParaPaso(secreto, paso());
    const ok = await entrar(operador.email, codigo);
    expect(ok.status).toBe(200);
    expect(ok.body.accessToken).toBeTruthy();
    const repetido = await entrar(operador.email, codigo);
    expect(repetido.status).toBe(401);
  });

  it('un código de recuperación entra una sola vez', async () => {
    await liberar();
    const codigo = recuperacion[0];
    expect((await entrar(operador.email, codigo)).status).toBe(200);
    expect((await entrar(operador.email, codigo)).status).toBe(401);
    expect((await http().get('/api/auth/mfa').set(auth(operador.token))).body.codigosDeRecuperacionRestantes).toBe(9);
  });

  it('tras 5 códigos equivocados seguidos se bloquea: ni el código correcto entra', async () => {
    await liberar();
    for (let i = 0; i < 5; i++) expect((await entrar(operador.email, '000000')).status).toBe(401);
    const r = await entrar(operador.email, codigoParaPaso(secreto, paso()));
    expect(r.status).toBe(401);
    expect(r.body.message).toMatch(/Demasiados intentos/);
  });

  it('la bitácora del administrador registra el ingreso, los fallos y el bloqueo', async () => {
    const r = await http().get('/api/audit?entidad=usuario').set(auth(a.token));
    const acciones = (r.body as { accion: string; entidadId: string }[]).filter((x) => x.entidadId === operador.userId).map((x) => x.accion);
    for (const esperada of ['mfa.activado', 'auth.login', 'auth.login_fallido', 'mfa.bloqueado', 'mfa.codigo_recuperacion_usado']) {
      expect(acciones).toContain(esperada);
    }
  });

  it('el administrador de otra empresa no puede restablecer este segundo factor', async () => {
    const r = await http().post(`/api/auth/mfa/restablecer/${operador.userId}`).set(auth(b.token));
    expect(r.status).toBe(404);
    expect((await prisma().user.findUniqueOrThrow({ where: { id: operador.userId } })).mfaEnabledAt).not.toBeNull();
  });

  it('un operador no puede restablecer a nadie', async () => {
    expect((await http().post(`/api/auth/mfa/restablecer/${a.userId}`).set(auth(operador.token))).status).toBe(403);
  });

  it('el administrador de la empresa lo restablece y la persona vuelve a entrar solo con contraseña', async () => {
    const r = await http().post(`/api/auth/mfa/restablecer/${operador.userId}`).set(auth(a.token));
    expect(r.status).toBe(200);
    const ingreso = await entrar(operador.email);
    expect(ingreso.status).toBe(200);
    expect(ingreso.body.accessToken).toBeTruthy();
    expect(await prisma().mfaRecoveryCode.count({ where: { userId: operador.userId } })).toBe(0);
  });

  it('desactivar exige contraseña y código', async () => {
    const token = (await entrar(operador.email)).body.accessToken as string;
    const ini = await http().post('/api/auth/mfa/iniciar').set(auth(token));
    const nuevo = ini.body.secreto as string;
    expect((await http().post('/api/auth/mfa/activar').set(auth(token)).send({ codigo: codigoParaPaso(nuevo, paso()) })).status).toBe(200);
    await liberar();
    const mal = await http().post('/api/auth/mfa/desactivar').set(auth(token)).send({ password: 'Incorrecta999', codigo: codigoParaPaso(nuevo, paso()) });
    expect(mal.status).toBe(401);
    const bien = await http().post('/api/auth/mfa/desactivar').set(auth(token)).send({ password: PASSWORD, codigo: codigoParaPaso(nuevo, paso()) });
    expect(bien.status).toBe(200);
    expect((await http().get('/api/auth/mfa').set(auth(token))).body.activo).toBe(false);
  });
});
