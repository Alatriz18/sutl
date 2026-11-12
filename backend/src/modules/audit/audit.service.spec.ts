import { AuditService } from './audit.service';

describe('AuditService', () => {
  it('registra con la empresa y el actor', async () => {
    const prisma = { auditLog: { create: jest.fn().mockResolvedValue({}), findMany: jest.fn() } };
    const service = new AuditService(prisma as never);
    await service.registrar({ tenantId: 't1', userId: 'u1', accion: 'x.y', entidad: 'tarea', entidadId: 'k1', metadata: { a: 1 } });
    expect(prisma.auditLog.create.mock.calls[0][0].data).toEqual({
      tenantId: 't1', userId: 'u1', accion: 'x.y', entidad: 'tarea', entidadId: 'k1', metadata: { a: 1 },
    });
  });

  it('si la base falla, no lanza (la operación de negocio no se rompe)', async () => {
    const prisma = { auditLog: { create: jest.fn().mockRejectedValue(new Error('db caída')), findMany: jest.fn() } };
    const service = new AuditService(prisma as never);
    await expect(service.registrar({ tenantId: 't1', accion: 'x', entidad: 'e' })).resolves.toBeUndefined();
  });

  it('listar filtra siempre por empresa y limita el tamaño', async () => {
    const prisma = { auditLog: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]) } };
    const service = new AuditService(prisma as never);
    await service.listar('t1', { entidad: 'tarea', limite: 99999 });
    const arg = prisma.auditLog.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ tenantId: 't1', entidad: 'tarea' });
    expect(arg.take).toBe(500);
  });
});
