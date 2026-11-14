import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RolUsuario } from '@prisma/client';
import { UsersService } from './users.service';

function montar() {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn(),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'nuevo', email: data.email, rol: data.rol ?? 'operador' })),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'u1', ...data })),
    },
    partner: { findFirst: jest.fn() },
  };
  const audit = { registrar: jest.fn().mockResolvedValue(undefined) };
  return { service: new UsersService(prisma as never, audit as never), prisma, audit };
}

const base = { email: 'x@y.com', password: 'PasswordSeguro123', nombre: 'X' };

describe('UsersService · roles analista_sutl y proveedor (B5)', () => {
  describe('create', () => {
    it('un administrador de empresa no puede crear analistas de SUTL', async () => {
      const { service, prisma } = montar();
      await expect(service.create('t1', { ...base, rol: RolUsuario.analista_sutl }, RolUsuario.admin_tenant)).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('el super_admin sí puede crear un analista de SUTL', async () => {
      const { service, prisma } = montar();
      await service.create('sutl', { ...base, rol: RolUsuario.analista_sutl }, RolUsuario.super_admin, 'sa');
      expect(prisma.user.create.mock.calls[0][0].data).toMatchObject({ tenantId: 'sutl', rol: 'analista_sutl' });
    });

    it('un usuario proveedor exige el proveedor al que representa', async () => {
      const { service, prisma } = montar();
      await expect(service.create('t1', { ...base, rol: RolUsuario.proveedor }, RolUsuario.admin_tenant)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('el proveedor debe ser un proveedor activo de la misma empresa', async () => {
      const { service, prisma } = montar();
      prisma.partner.findFirst.mockResolvedValue(null);
      await expect(
        service.create('t1', { ...base, rol: RolUsuario.proveedor, partnerId: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }, RolUsuario.admin_tenant),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.partner.findFirst.mock.calls[0][0].where).toMatchObject({ tenantId: 't1', tipo: 'proveedor', activo: true });
    });

    it('con un proveedor válido lo crea ligado a él', async () => {
      const { service, prisma } = montar();
      prisma.partner.findFirst.mockResolvedValue({ id: 'p1' });
      await service.create('t1', { ...base, rol: RolUsuario.proveedor, partnerId: 'p1' }, RolUsuario.admin_tenant);
      expect(prisma.user.create.mock.calls[0][0].data).toMatchObject({ rol: 'proveedor', partnerId: 'p1', tenantId: 't1' });
    });

    it('los demás roles no llevan proveedor asociado', async () => {
      const { service } = montar();
      await expect(service.create('t1', { ...base, rol: RolUsuario.operador, partnerId: 'p1' }, RolUsuario.admin_tenant)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('update', () => {
    const existente = (rol: RolUsuario, partnerId: string | null = null) => ({ id: 'u1', rol, partnerId, tenantId: 't1' });

    it('un administrador de empresa no puede ascender a alguien a analista de SUTL', async () => {
      const { service, prisma } = montar();
      prisma.user.findFirst.mockResolvedValue(existente(RolUsuario.operador));
      await expect(service.update('t1', 'u1', { rol: RolUsuario.analista_sutl }, RolUsuario.admin_tenant)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('un administrador de empresa no puede gestionar a un analista de SUTL', async () => {
      const { service, prisma } = montar();
      prisma.user.findFirst.mockResolvedValue(existente(RolUsuario.analista_sutl));
      await expect(service.update('t1', 'u1', { nombre: 'Otro' }, RolUsuario.admin_tenant)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.remove('t1', 'u1', RolUsuario.admin_tenant)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('al dejar de ser proveedor se limpia su proveedor asociado', async () => {
      const { service, prisma } = montar();
      prisma.user.findFirst.mockResolvedValue(existente(RolUsuario.proveedor, 'p1'));
      await service.update('t1', 'u1', { rol: RolUsuario.operador }, RolUsuario.admin_tenant);
      expect(prisma.user.update.mock.calls[0][0].data).toMatchObject({ rol: 'operador', partnerId: null });
    });

    it('editar un proveedor sin tocar su rol conserva su proveedor asociado', async () => {
      const { service, prisma } = montar();
      prisma.user.findFirst.mockResolvedValue(existente(RolUsuario.proveedor, 'p1'));
      prisma.partner.findFirst.mockResolvedValue({ id: 'p1' });
      await service.update('t1', 'u1', { nombre: 'Nuevo nombre' }, RolUsuario.admin_tenant);
      expect(prisma.user.update.mock.calls[0][0].data).toMatchObject({ nombre: 'Nuevo nombre', partnerId: 'p1' });
    });

    it('pasar a proveedor exige indicar cuál', async () => {
      const { service, prisma } = montar();
      prisma.user.findFirst.mockResolvedValue(existente(RolUsuario.operador));
      await expect(service.update('t1', 'u1', { rol: RolUsuario.proveedor }, RolUsuario.admin_tenant)).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
