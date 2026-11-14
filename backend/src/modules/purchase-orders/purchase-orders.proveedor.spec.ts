import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';

// Vista del proveedor externo (B5): solo sus órdenes ya emitidas y sin datos internos.
function montar() {
  const prisma = {
    user: { findFirst: jest.fn() },
    purchaseOrder: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn() },
  };
  const service = new PurchaseOrdersService(prisma as never, {} as never);
  return { service, prisma };
}

describe('PurchaseOrdersService · proveedor externo', () => {
  describe('proveedorDe', () => {
    it('busca al usuario proveedor activo de esa empresa', async () => {
      const { service, prisma } = montar();
      prisma.user.findFirst.mockResolvedValue({ partnerId: 'p1' });
      await expect(service.proveedorDe('t1', 'u1')).resolves.toBe('p1');
      expect(prisma.user.findFirst.mock.calls[0][0].where).toEqual({ id: 'u1', tenantId: 't1', rol: 'proveedor', activo: true });
    });

    it('sin proveedor asociado no ve nada', async () => {
      const { service, prisma } = montar();
      prisma.user.findFirst.mockResolvedValue({ partnerId: null });
      await expect(service.proveedorDe('t1', 'u1')).rejects.toBeInstanceOf(ForbiddenException);
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.proveedorDe('t1', 'u1')).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('findAllDeProveedor', () => {
    it('filtra por empresa y por SU proveedor, sin borradores', async () => {
      const { service, prisma } = montar();
      await service.findAllDeProveedor('t1', 'p1');
      expect(prisma.purchaseOrder.findMany.mock.calls[0][0].where).toEqual({ tenantId: 't1', proveedorId: 'p1', estado: { not: 'borrador' } });
    });

    it('un filtro de estado borrador no le deja ver borradores', async () => {
      const { service, prisma } = montar();
      await service.findAllDeProveedor('t1', 'p1', { estado: 'borrador' });
      expect(prisma.purchaseOrder.findMany.mock.calls[0][0].where.estado).toEqual({ not: 'borrador' });
    });

    it('puede filtrar por otro estado, pero el proveedor ajeno del parámetro se ignora', async () => {
      const { service, prisma } = montar();
      await service.findAllDeProveedor('t1', 'p1', { estado: 'confirmada', proveedorId: 'otro-proveedor' });
      const where = prisma.purchaseOrder.findMany.mock.calls[0][0].where;
      expect(where).toMatchObject({ proveedorId: 'p1', estado: 'confirmada' });
    });

    it('no pide datos internos (notas, creador, recepciones en bodega)', async () => {
      const { service, prisma } = montar();
      await service.findAllDeProveedor('t1', 'p1');
      const select = prisma.purchaseOrder.findMany.mock.calls[0][0].select;
      expect(select).not.toHaveProperty('notas');
      expect(select).not.toHaveProperty('creadoPorId');
      expect(select).not.toHaveProperty('creadoPor');
      expect(select.lineas.select).not.toHaveProperty('recepciones');
    });
  });

  describe('findOneDeProveedor', () => {
    it('una OC de otro proveedor responde igual que una inexistente', async () => {
      const { service, prisma } = montar();
      prisma.purchaseOrder.findFirst.mockResolvedValue(null);
      await expect(service.findOneDeProveedor('t1', 'p1', 'oc-de-otro')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.purchaseOrder.findFirst.mock.calls[0][0].where).toEqual({ id: 'oc-de-otro', tenantId: 't1', proveedorId: 'p1', estado: { not: 'borrador' } });
    });
  });
});
