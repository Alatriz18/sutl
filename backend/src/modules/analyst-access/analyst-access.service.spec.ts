import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AnalystAccessService } from './analyst-access.service';

function montar() {
  const prisma = {
    user: { findFirst: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    tenant: { findFirst: jest.fn() },
    analystGrant: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      upsert: jest.fn().mockResolvedValue({ id: 'g1' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const audit = { registrar: jest.fn().mockResolvedValue(undefined) };
  return { service: new AnalystAccessService(prisma as never, audit as never), prisma, audit };
}

describe('AnalystAccessService', () => {
  describe('accesoVigente', () => {
    it('solo cuenta con permiso activo, analista activo y empresa activa', async () => {
      const { service, prisma } = montar();
      await service.accesoVigente('a1', 'cliente');
      expect(prisma.analystGrant.findFirst.mock.calls[0][0].where).toEqual({
        analystId: 'a1',
        tenantId: 'cliente',
        activo: true,
        analyst: { activo: true, rol: 'analista_sutl' },
        tenant: { activo: true },
      });
    });
  });

  describe('otorgar', () => {
    it('el analista debe existir y ser analista_sutl activo', async () => {
      const { service, prisma } = montar();
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.otorgar('sa', { analystId: 'x', tenantId: 'c' })).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.user.findFirst.mock.calls[0][0].where).toMatchObject({ id: 'x', rol: 'analista_sutl', activo: true });
    });

    it('no tiene sentido darle permiso sobre su propia empresa', async () => {
      const { service, prisma } = montar();
      prisma.user.findFirst.mockResolvedValue({ id: 'a1', tenantId: 'sutl', email: 'a@sutl.com' });
      await expect(service.otorgar('sa', { analystId: 'a1', tenantId: 'sutl' })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('la empresa debe existir y estar activa', async () => {
      const { service, prisma } = montar();
      prisma.user.findFirst.mockResolvedValue({ id: 'a1', tenantId: 'sutl', email: 'a@sutl.com' });
      prisma.tenant.findFirst.mockResolvedValue(null);
      await expect(service.otorgar('sa', { analystId: 'a1', tenantId: 'c' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('por defecto es solo lectura, se reactiva si ya existía y queda en la bitácora de la empresa', async () => {
      const { service, prisma, audit } = montar();
      prisma.user.findFirst.mockResolvedValue({ id: 'a1', tenantId: 'sutl', email: 'a@sutl.com' });
      prisma.tenant.findFirst.mockResolvedValue({ id: 'c' });
      await service.otorgar('sa', { analystId: 'a1', tenantId: 'c' });
      const arg = prisma.analystGrant.upsert.mock.calls[0][0];
      expect(arg.create).toMatchObject({ analystId: 'a1', tenantId: 'c', soloLectura: true, otorgadoPorId: 'sa' });
      expect(arg.update).toMatchObject({ activo: true, revocadoAt: null, soloLectura: true });
      expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'c', userId: 'sa', accion: 'analista.acceso_otorgado' }));
    });

    it('el acceso de gestión se concede a propósito', async () => {
      const { service, prisma } = montar();
      prisma.user.findFirst.mockResolvedValue({ id: 'a1', tenantId: 'sutl', email: 'a@sutl.com' });
      prisma.tenant.findFirst.mockResolvedValue({ id: 'c' });
      await service.otorgar('sa', { analystId: 'a1', tenantId: 'c', soloLectura: false });
      expect(prisma.analystGrant.upsert.mock.calls[0][0].create.soloLectura).toBe(false);
    });
  });

  describe('revocar', () => {
    it('un permiso inexistente da 404', async () => {
      const { service, prisma } = montar();
      prisma.analystGrant.findUnique.mockResolvedValue(null);
      await expect(service.revocar('sa', 'g1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('desactiva, devuelve al analista a su empresa y deja registro', async () => {
      const { service, prisma, audit } = montar();
      prisma.analystGrant.findUnique.mockResolvedValue({ id: 'g1', analystId: 'a1', tenantId: 'c', analyst: { email: 'a@sutl.com' } });
      await service.revocar('sa', 'g1');
      expect(prisma.analystGrant.updateMany).toHaveBeenCalledWith({ where: { id: 'g1', activo: true }, data: expect.objectContaining({ activo: false }) });
      expect(prisma.user.updateMany).toHaveBeenCalledWith({ where: { id: 'a1', empresaActivaId: 'c' }, data: { empresaActivaId: null } });
      expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'c', accion: 'analista.acceso_revocado' }));
    });

    it('revocar dos veces no repite la bitácora', async () => {
      const { service, prisma, audit } = montar();
      prisma.analystGrant.findUnique.mockResolvedValue({ id: 'g1', analystId: 'a1', tenantId: 'c', analyst: { email: 'a@sutl.com' } });
      prisma.analystGrant.updateMany.mockResolvedValue({ count: 0 });
      await service.revocar('sa', 'g1');
      expect(audit.registrar).not.toHaveBeenCalled();
    });
  });
});
