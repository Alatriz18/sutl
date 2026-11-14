import { ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

// Contexto de empresa del analista de SUTL (B5): el token siempre lleva la empresa
// donde trabaja y la de origen, y solo sale de la suya con un permiso vigente.
function montar() {
  const tokens: Record<string, unknown>[] = [];
  const prisma = {
    user: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn().mockResolvedValue({}) },
    tenant: { findUnique: jest.fn() },
  };
  const jwt = {
    sign: jest.fn().mockImplementation((payload: Record<string, unknown>) => {
      tokens.push(payload);
      return `token-${tokens.length}`;
    }),
  };
  const config = { get: jest.fn().mockReturnValue(undefined) };
  const audit = { registrar: jest.fn().mockResolvedValue(undefined) };
  const access = { accesoVigente: jest.fn(), empresasDe: jest.fn().mockResolvedValue([]) };
  const service = new AuthService(prisma as never, jwt as never, config as never, {} as never, audit as never, access as never);
  return { service, prisma, jwt, audit, access, tokens };
}

const analista = (extra: Record<string, unknown> = {}) => ({
  id: 'a1', tenantId: 'sutl', rol: 'analista_sutl', email: 'a@sutl.com', activo: true, empresaActivaId: null, refreshTokenHash: null, ...extra,
});

describe('AuthService · analista de SUTL', () => {
  describe('refresh / emisión de tokens', () => {
    it('un usuario normal no lleva empresa de origen', async () => {
      const { service, prisma, tokens } = montar();
      const refreshToken = 'rt';
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', tenantId: 't1', rol: 'operador', email: 'u@x.com', empresaActivaId: null, refreshTokenHash: await bcrypt.hash(refreshToken, 4) });
      await service.refresh('u1', refreshToken);
      expect(tokens[0]).toEqual({ sub: 'u1', tenantId: 't1', rol: 'operador', email: 'u@x.com' });
    });

    it('un usuario normal nunca sale de su empresa aunque tenga empresaActivaId', async () => {
      const { service, prisma, tokens, access } = montar();
      const refreshToken = 'rt';
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', tenantId: 't1', rol: 'operador', email: 'u@x.com', empresaActivaId: 'otra', refreshTokenHash: await bcrypt.hash(refreshToken, 4) });
      await service.refresh('u1', refreshToken);
      expect(tokens[0]).toMatchObject({ tenantId: 't1' });
      expect(access.accesoVigente).not.toHaveBeenCalled();
    });

    it('el analista sin empresa activa trabaja en la suya y lleva su origen', async () => {
      const { service, prisma, tokens } = montar();
      prisma.user.findUnique.mockResolvedValue(analista({ refreshTokenHash: await bcrypt.hash('rt', 4) }));
      await service.refresh('a1', 'rt');
      expect(tokens[0]).toMatchObject({ tenantId: 'sutl', origen: 'sutl', rol: 'analista_sutl' });
    });

    it('el analista con empresa activa y permiso vigente conserva su contexto al renovar', async () => {
      const { service, prisma, tokens, access } = montar();
      prisma.user.findUnique.mockResolvedValue(analista({ empresaActivaId: 'cliente', refreshTokenHash: await bcrypt.hash('rt', 4) }));
      access.accesoVigente.mockResolvedValue({ id: 'g1', soloLectura: true });
      await service.refresh('a1', 'rt');
      expect(tokens[0]).toMatchObject({ tenantId: 'cliente', origen: 'sutl' });
    });

    it('si perdió el permiso, al renovar vuelve a su empresa y se limpia la empresa activa', async () => {
      const { service, prisma, tokens, access } = montar();
      prisma.user.findUnique.mockResolvedValue(analista({ empresaActivaId: 'cliente', refreshTokenHash: await bcrypt.hash('rt', 4) }));
      access.accesoVigente.mockResolvedValue(null);
      await service.refresh('a1', 'rt');
      expect(tokens[0]).toMatchObject({ tenantId: 'sutl', origen: 'sutl' });
      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'a1' }, data: { empresaActivaId: null } });
    });
  });

  describe('cambiarEmpresa', () => {
    it('solo lo usa un analista de SUTL activo', async () => {
      const { service, prisma } = montar();
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', tenantId: 't1', rol: 'admin_tenant', activo: true });
      await expect(service.cambiarEmpresa('u1', 'otra')).rejects.toBeInstanceOf(ForbiddenException);
      prisma.user.findUnique.mockResolvedValue(analista({ activo: false }));
      await expect(service.cambiarEmpresa('a1', 'otra')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('exige un permiso vigente sobre la empresa elegida', async () => {
      const { service, prisma, access } = montar();
      prisma.user.findUnique.mockResolvedValue(analista());
      access.accesoVigente.mockResolvedValue(null);
      await expect(service.cambiarEmpresa('a1', 'cliente')).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('con permiso: guarda la empresa activa, deja la entrada en la bitácora de esa empresa y emite el token', async () => {
      const { service, prisma, access, audit, tokens } = montar();
      prisma.user.findUnique.mockResolvedValue(analista());
      access.accesoVigente.mockResolvedValue({ id: 'g1', soloLectura: true });
      await service.cambiarEmpresa('a1', 'cliente');
      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'a1' }, data: { empresaActivaId: 'cliente' } });
      expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'cliente', userId: 'a1', accion: 'analista.ingreso_empresa' }));
      expect(tokens[tokens.length - 1]).toMatchObject({ tenantId: 'cliente', origen: 'sutl' });
    });

    it('volver a su propia empresa no necesita permiso y limpia la empresa activa', async () => {
      const { service, prisma, access, tokens } = montar();
      prisma.user.findUnique.mockResolvedValue(analista({ empresaActivaId: 'cliente' }));
      await service.cambiarEmpresa('a1', 'sutl');
      expect(access.accesoVigente).not.toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'a1' }, data: { empresaActivaId: null } });
      expect(tokens[tokens.length - 1]).toMatchObject({ tenantId: 'sutl', origen: 'sutl' });
    });
  });

  describe('empresasAccesibles', () => {
    it('lista la propia y las que tiene con permiso, e indica cuál está activa', async () => {
      const { service, prisma, access } = montar();
      prisma.user.findUnique.mockResolvedValue(analista());
      prisma.tenant.findUnique.mockResolvedValue({ id: 'sutl', nombre: 'SUTL' });
      access.empresasDe.mockResolvedValue([{ soloLectura: true, tenant: { id: 'cliente', nombre: 'Cliente SA' } }]);
      const r = await service.empresasAccesibles('a1');
      expect(r.activaId).toBe('sutl');
      expect(r.empresas).toEqual([
        { id: 'sutl', nombre: 'SUTL', propia: true, soloLectura: false },
        { id: 'cliente', nombre: 'Cliente SA', propia: false, soloLectura: true },
      ]);
    });
  });
});
