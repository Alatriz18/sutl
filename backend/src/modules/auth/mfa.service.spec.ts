import { randomBytes } from 'crypto';
import { ConflictException, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { RolUsuario } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { cifrar } from '../../common/crypto';
import { codigoParaPaso, generarSecreto, hashCodigoRecuperacion, paso } from '../../common/totp';
import { MfaService } from './mfa.service';

type Mock = jest.Mock;

describe('MfaService', () => {
  const original = process.env.ENCRYPTION_KEY;
  const actor = { userId: 'u1', tenantId: 't1', rol: RolUsuario.operador, email: 'ana@x.com' };
  const secreto = generarSecreto();
  let prisma: {
    user: { findUniqueOrThrow: Mock; findFirst: Mock; update: Mock; updateMany: Mock };
    mfaRecoveryCode: { count: Mock; deleteMany: Mock; createMany: Mock; updateMany: Mock };
  };
  let audit: { registrar: Mock };
  let service: MfaService;

  const usuario = (o: Record<string, unknown> = {}) => ({
    id: 'u1', tenantId: 't1', email: 'ana@x.com', password: '', mfaSecret: cifrar(secreto), mfaEnabledAt: new Date(), mfaLastStep: null, mfaLockedUntil: null, ...o,
  });
  const codigoActual = () => codigoParaPaso(secreto, paso());

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = randomBytes(32).toString('base64');
  });
  afterAll(() => {
    if (original === undefined) delete process.env.ENCRYPTION_KEY;
    else process.env.ENCRYPTION_KEY = original;
  });

  beforeEach(() => {
    prisma = {
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(usuario()),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({ mfaFailures: 1 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      mfaRecoveryCode: {
        count: jest.fn().mockResolvedValue(8),
        deleteMany: jest.fn().mockResolvedValue({}),
        createMany: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    audit = { registrar: jest.fn().mockResolvedValue(undefined) };
    service = new MfaService(prisma as never, audit as never);
  });

  describe('activación', () => {
    it('iniciar guarda el secreto CIFRADO y devuelve la URL para la app', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({ mfaEnabledAt: null });
      const r = await service.iniciar(actor);
      expect(r.secreto).toMatch(/^[A-Z2-7]{32}$/);
      expect(r.otpauthUrl).toContain(`secret=${r.secreto}`);
      const guardado = prisma.user.update.mock.calls[0][0].data.mfaSecret as string;
      expect(guardado.startsWith('v1:')).toBe(true);
      expect(guardado).not.toContain(r.secreto);
    });

    it('sin ENCRYPTION_KEY responde 503 en vez de guardar el secreto en claro', async () => {
      const k = process.env.ENCRYPTION_KEY;
      delete process.env.ENCRYPTION_KEY;
      try {
        await expect(service.iniciar(actor)).rejects.toThrow(/no está disponible/);
        expect(prisma.user.update).not.toHaveBeenCalled();
      } finally {
        process.env.ENCRYPTION_KEY = k;
      }
    });

    it('no se puede iniciar si ya está activo', async () => {
      await expect(service.iniciar(actor)).rejects.toBeInstanceOf(ConflictException);
    });

    it('activar con un código correcto activa y entrega 10 códigos de recuperación (solo su huella se guarda)', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue(usuario({ mfaEnabledAt: null }));
      const r = await service.activar(actor, codigoActual());
      expect(r.codigosDeRecuperacion).toHaveLength(10);
      const guardados = prisma.mfaRecoveryCode.createMany.mock.calls[0][0].data as { codeHash: string }[];
      expect(guardados.map((g) => g.codeHash)).toEqual(r.codigosDeRecuperacion.map(hashCodigoRecuperacion));
      expect(JSON.stringify(guardados)).not.toContain(r.codigosDeRecuperacion[0]);
      expect(audit.registrar.mock.calls[0][0].accion).toBe('mfa.activado');
    });

    it('activar con un código equivocado no activa nada', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue(usuario({ mfaEnabledAt: null }));
      await expect(service.activar(actor, '000000')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.user.updateMany).not.toHaveBeenCalled();
    });

    it('activar sin haber generado el secreto responde 409', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue(usuario({ mfaEnabledAt: null, mfaSecret: null }));
      await expect(service.activar(actor, '123456')).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('verificar el segundo factor al ingresar', () => {
    it('acepta el código vigente y recuerda el paso para que no se reutilice', async () => {
      await expect(service.verificarSegundoFactor(usuario(), codigoActual())).resolves.toBeUndefined();
      const llamada = prisma.user.updateMany.mock.calls[0][0];
      expect(llamada.where).toEqual({ id: 'u1', OR: [{ mfaLastStep: null }, { mfaLastStep: { lt: expect.any(Number) } }] });
    });

    it('el mismo código no sirve dos veces (la actualización condicional no encuentra fila)', async () => {
      prisma.user.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.verificarSegundoFactor(usuario({ mfaLastStep: paso() }), codigoActual())).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('un código equivocado cuenta como fallo', async () => {
      await expect(service.verificarSegundoFactor(usuario(), '000000')).rejects.toThrow('Código de verificación inválido');
      expect(prisma.user.update.mock.calls[0][0].data).toEqual({ mfaFailures: { increment: 1 } });
    });

    it('al quinto fallo seguido bloquea 15 minutos', async () => {
      prisma.user.update.mockResolvedValueOnce({ mfaFailures: 5 }).mockResolvedValue({});
      await expect(service.verificarSegundoFactor(usuario(), '000000')).rejects.toBeInstanceOf(UnauthorizedException);
      const bloqueo = prisma.user.update.mock.calls[1][0].data;
      expect(bloqueo.mfaFailures).toBe(0);
      expect((bloqueo.mfaLockedUntil as Date).getTime()).toBeGreaterThan(Date.now() + 14 * 60_000);
      expect(audit.registrar.mock.calls.some((c) => c[0].accion === 'mfa.bloqueado')).toBe(true);
    });

    it('bloqueada: rechaza hasta un código correcto, sin intentar validarlo', async () => {
      const u = usuario({ mfaLockedUntil: new Date(Date.now() + 60_000) });
      await expect(service.verificarSegundoFactor(u, codigoActual())).rejects.toThrow(/Demasiados intentos/);
      expect(prisma.user.updateMany).not.toHaveBeenCalled();
    });

    it('un código de recuperación vale una vez', async () => {
      prisma.mfaRecoveryCode.updateMany.mockResolvedValue({ count: 1 });
      await expect(service.verificarSegundoFactor(usuario(), 'abcd-2345')).resolves.toBeUndefined();
      expect(prisma.mfaRecoveryCode.updateMany.mock.calls[0][0].where).toEqual({ userId: 'u1', codeHash: hashCodigoRecuperacion('ABCD2345'), usedAt: null });
      expect(audit.registrar.mock.calls[0][0].accion).toBe('mfa.codigo_recuperacion_usado');

      prisma.mfaRecoveryCode.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.verificarSegundoFactor(usuario(), 'abcd-2345')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('desactivar', () => {
    it('exige la contraseña correcta', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue(usuario({ password: await bcrypt.hash('Correcta123', 4) }));
      await expect(service.desactivar(actor, 'Incorrecta', codigoActual())).rejects.toThrow('Contraseña incorrecta');
      expect(prisma.mfaRecoveryCode.deleteMany).not.toHaveBeenCalled();
    });

    it('con contraseña y código correctos limpia todo y deja constancia', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue(usuario({ password: await bcrypt.hash('Correcta123', 4) }));
      await service.desactivar(actor, 'Correcta123', codigoActual());
      const limpio = prisma.user.update.mock.calls.at(-1)?.[0].data;
      expect(limpio).toMatchObject({ mfaSecret: null, mfaEnabledAt: null });
      expect(limpio).not.toHaveProperty('refreshTokenHash');
      expect(prisma.mfaRecoveryCode.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
      expect(audit.registrar.mock.calls.at(-1)?.[0].accion).toBe('mfa.desactivado');
    });
  });

  describe('restablecer (administrador)', () => {
    const admin = { userId: 'adm', tenantId: 't1', rol: RolUsuario.admin_tenant, email: 'adm@x.com' };

    it('busca al usuario dentro de la empresa del administrador: de otra empresa responde 404', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.restablecer(admin, 'ajeno')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.user.findFirst.mock.calls[0][0].where).toEqual({ id: 'ajeno', tenantId: 't1' });
    });

    it('un administrador de empresa no toca a un super administrador', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'sa', tenantId: 't1', rol: RolUsuario.super_admin });
      await expect(service.restablecer(admin, 'sa')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('restablece, cierra la sesión de esa persona y lo anota con el administrador como actor', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'u9', tenantId: 't1', rol: RolUsuario.operador });
      await service.restablecer(admin, 'u9');
      expect(prisma.user.update.mock.calls[0][0].data).toMatchObject({ mfaSecret: null, mfaEnabledAt: null, refreshTokenHash: null });
      expect(audit.registrar.mock.calls[0][0]).toMatchObject({ accion: 'mfa.restablecido', userId: 'adm', entidadId: 'u9' });
    });
  });

  it('estado cuenta los códigos de recuperación sin usar', async () => {
    const r = await service.estado('u1');
    expect(r).toMatchObject({ activo: true, codigosDeRecuperacionRestantes: 8 });
  });
});
