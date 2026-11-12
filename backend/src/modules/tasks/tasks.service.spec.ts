import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RolUsuario } from '@prisma/client';
import { TasksService } from './tasks.service';

type Mock = jest.Mock;

describe('TasksService', () => {
  const admin = { userId: 'u-admin', tenantId: 't1', rol: RolUsuario.admin_tenant, email: 'a@x.com' };
  const op = { userId: 'u-op', tenantId: 't1', rol: RolUsuario.operador, email: 'o@x.com' };
  const base = {
    id: 'k1', tenantId: 't1', titulo: 'Confirmar fecha', descripcion: null, estado: 'abierta', prioridad: 'media',
    asignadoAId: null, creadoPorId: 'u-admin', fechaLimite: null, completadaAt: null, entidadTipo: null, entidadId: null,
    updatedAt: new Date('2026-11-12T10:00:00Z'),
  };
  let prisma: {
    task: { findFirst: Mock; findFirstOrThrow: Mock; findMany: Mock; create: Mock; updateMany: Mock };
    taskComment: { create: Mock };
    auditLog: { findMany: Mock };
    user: { findFirst: Mock };
    purchaseOrder: { count: Mock };
    shipment: { count: Mock };
  };
  let audit: { registrar: Mock };
  let service: TasksService;

  beforeEach(() => {
    prisma = {
      task: {
        findFirst: jest.fn().mockResolvedValue(base),
        findFirstOrThrow: jest.fn().mockResolvedValue(base),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'k1', ...data })),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      taskComment: { create: jest.fn().mockResolvedValue({ id: 'c1' }) },
      auditLog: { findMany: jest.fn().mockResolvedValue([]) },
      user: { findFirst: jest.fn().mockResolvedValue({ rol: RolUsuario.operador }) },
      purchaseOrder: { count: jest.fn().mockResolvedValue(1) },
      shipment: { count: jest.fn().mockResolvedValue(1) },
    };
    audit = { registrar: jest.fn().mockResolvedValue(undefined) };
    service = new TasksService(prisma as never, audit as never);
  });

  describe('create', () => {
    it('crea la tarea en la empresa de quien la crea y deja constancia en la bitácora', async () => {
      await service.create(admin, { titulo: '  Llamar al proveedor ', asignadoAId: 'u-op' });
      const data = prisma.task.create.mock.calls[0][0].data;
      expect(data).toMatchObject({ tenantId: 't1', creadoPorId: 'u-admin', titulo: 'Llamar al proveedor', asignadoAId: 'u-op' });
      expect(audit.registrar.mock.calls[0][0]).toMatchObject({ tenantId: 't1', userId: 'u-admin', accion: 'tarea.creada', entidad: 'tarea', entidadId: 'k1' });
    });

    it('el responsable se busca dentro de la misma empresa: de otra empresa responde 404', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.create(admin, { titulo: 'x', asignadoAId: 'u-ajeno' })).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.user.findFirst.mock.calls[0][0].where).toMatchObject({ id: 'u-ajeno', tenantId: 't1', activo: true });
      expect(prisma.task.create).not.toHaveBeenCalled();
    });

    it('no se asigna a un cliente final', async () => {
      prisma.user.findFirst.mockResolvedValue({ rol: RolUsuario.cliente_final });
      await expect(service.create(admin, { titulo: 'x', asignadoAId: 'u-cf' })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('la OC o el envío referido deben ser de la empresa', async () => {
      prisma.purchaseOrder.count.mockResolvedValue(0);
      await expect(service.create(admin, { titulo: 'x', entidadTipo: 'orden_compra', entidadId: 'oc-ajena' })).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.purchaseOrder.count).toHaveBeenCalledWith({ where: { id: 'oc-ajena', tenantId: 't1' } });
      prisma.shipment.count.mockResolvedValue(0);
      await expect(service.create(admin, { titulo: 'x', entidadTipo: 'envio', entidadId: 'e-ajeno' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('una tarea sobre un SKU guarda el código sin consultar otras tablas', async () => {
      await service.create(admin, { titulo: 'x', entidadTipo: 'sku', entidadId: 'SKU-1' });
      expect(prisma.task.create.mock.calls[0][0].data).toMatchObject({ entidadTipo: 'sku', entidadId: 'SKU-1' });
      expect(prisma.purchaseOrder.count).not.toHaveBeenCalled();
    });

    it('si la bitácora falla igual devuelve la tarea (el servicio de bitácora nunca lanza)', async () => {
      audit.registrar.mockResolvedValue(undefined);
      await expect(service.create(admin, { titulo: 'x' })).resolves.toMatchObject({ id: 'k1' });
    });
  });

  describe('update', () => {
    it('una tarea de otra empresa no existe (404)', async () => {
      prisma.task.findFirst.mockResolvedValue(null);
      await expect(service.update(admin, 'k9', { titulo: 'x' })).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.task.findFirst.mock.calls[0][0].where).toEqual({ id: 'k9', tenantId: 't1' });
    });

    it('un operador ajeno a la tarea no puede modificarla', async () => {
      await expect(service.update(op, 'k1', { titulo: 'x' })).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.task.updateMany).not.toHaveBeenCalled();
    });

    it('el responsable sí puede cambiarla, y el administrador cualquiera', async () => {
      prisma.task.findFirst.mockResolvedValue({ ...base, asignadoAId: 'u-op' });
      await service.update(op, 'k1', { estado: 'en_curso' });
      expect(prisma.task.updateMany).toHaveBeenCalledTimes(1);
      prisma.task.findFirst.mockResolvedValue(base);
      await service.update(admin, 'k1', { prioridad: 'alta' });
      expect(prisma.task.updateMany).toHaveBeenCalledTimes(2);
    });

    it('marcar hecha guarda cuándo se completó y reabrirla lo borra', async () => {
      await service.update(admin, 'k1', { estado: 'hecha' });
      let data = prisma.task.updateMany.mock.calls[0][0].data;
      expect(data.estado).toBe('hecha');
      expect(data.completadaAt).toBeInstanceOf(Date);
      expect(audit.registrar.mock.calls[0][0].accion).toBe('tarea.hecha');

      prisma.task.findFirst.mockResolvedValue({ ...base, estado: 'hecha', completadaAt: new Date() });
      await service.update(admin, 'k1', { estado: 'abierta' });
      data = prisma.task.updateMany.mock.calls[1][0].data;
      expect(data.completadaAt).toBeNull();
    });

    it('registra en la bitácora solo lo que cambió, con el valor anterior', async () => {
      await service.update(admin, 'k1', { titulo: 'Confirmar fecha', prioridad: 'alta' });
      const meta = audit.registrar.mock.calls[0][0].metadata as { cambios: Record<string, unknown> };
      expect(Object.keys(meta.cambios)).toEqual(['prioridad']);
      expect(meta.cambios.prioridad).toEqual({ de: 'media', a: 'alta' });
    });

    it('sin cambios reales no escribe nada ni ensucia la bitácora', async () => {
      await service.update(admin, 'k1', { prioridad: 'media' });
      expect(prisma.task.updateMany).not.toHaveBeenCalled();
      expect(audit.registrar).not.toHaveBeenCalled();
    });

    it('quitar el responsable con null funciona', async () => {
      prisma.task.findFirst.mockResolvedValue({ ...base, asignadoAId: 'u-op' });
      await service.update(admin, 'k1', { asignadoAId: null });
      expect(prisma.task.updateMany.mock.calls[0][0].data.asignadoAId).toBeNull();
    });

    it('una tarea cancelada no se edita sin reabrirla', async () => {
      prisma.task.findFirst.mockResolvedValue({ ...base, estado: 'cancelada' });
      await expect(service.update(admin, 'k1', { titulo: 'x' })).rejects.toBeInstanceOf(ConflictException);
      await expect(service.update(admin, 'k1', { estado: 'abierta' })).resolves.toBeDefined();
    });

    it('si alguien la modificó antes (versión distinta) responde 409 y no registra nada', async () => {
      prisma.task.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.update(admin, 'k1', { prioridad: 'alta' })).rejects.toBeInstanceOf(ConflictException);
      expect(audit.registrar).not.toHaveBeenCalled();
      expect(prisma.task.updateMany.mock.calls[0][0].where).toMatchObject({ id: 'k1', tenantId: 't1', updatedAt: base.updatedAt });
    });
  });

  describe('comentar', () => {
    it('comenta en una tarea de la empresa y lo anota en la bitácora', async () => {
      await service.comentar(op, 'k1', { texto: '  Ya llamé  ' });
      expect(prisma.taskComment.create.mock.calls[0][0].data).toEqual({ tenantId: 't1', taskId: 'k1', autorId: 'u-op', texto: 'Ya llamé' });
      expect(audit.registrar.mock.calls[0][0]).toMatchObject({ accion: 'tarea.comentada', entidadId: 'k1' });
    });

    it('en una tarea de otra empresa responde 404', async () => {
      prisma.task.findFirst.mockResolvedValue(null);
      await expect(service.comentar(op, 'k9', { texto: 'x' })).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.taskComment.create).not.toHaveBeenCalled();
    });
  });

  describe('consultas', () => {
    it('el listado siempre filtra por empresa; "mias" usa al usuario de la sesión', async () => {
      await service.findAll(op, { mias: 'true', estado: 'abierta' });
      expect(prisma.task.findMany.mock.calls[0][0].where).toEqual({ tenantId: 't1', estado: 'abierta', asignadoAId: 'u-op' });
    });

    it('el detalle incluye comentarios y la bitácora de esa tarea, de esa empresa', async () => {
      prisma.task.findFirst.mockResolvedValue({ ...base, comentarios: [] });
      const r = await service.findOne('t1', 'k1');
      expect(r.bitacora).toEqual([]);
      expect(prisma.auditLog.findMany.mock.calls[0][0].where).toEqual({ tenantId: 't1', entidad: 'tarea', entidadId: 'k1' });
    });

    it('el detalle de una tarea ajena responde 404', async () => {
      prisma.task.findFirst.mockResolvedValue(null);
      await expect(service.findOne('t1', 'k9')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
