import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RequestUser } from '../../common/interfaces/jwt-payload.interface';
import { PortalService } from './portal.service';

function montar() {
  const prisma = {
    purchaseOrder: { findFirst: jest.fn() },
    shipment: { findFirst: jest.fn() },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    portalMessage: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'm1', texto: 'hola', createdAt: new Date() }),
    },
  };
  const audit = { registrar: jest.fn().mockResolvedValue(undefined) };
  const ordenes = {
    proveedorDe: jest.fn().mockResolvedValue('p1'),
    findOneDeProveedor: jest.fn(),
    transicion: jest.fn().mockResolvedValue({}),
  };
  const notifications = { create: jest.fn().mockResolvedValue({}) };
  const service = new PortalService(prisma as never, audit as never, ordenes as never, notifications as never);
  return { service, prisma, audit, ordenes, notifications };
}

const u = (rol: RequestUser['rol'], extra: Partial<RequestUser> = {}): RequestUser => ({ userId: 'u1', tenantId: 't1', rol, email: 'x@y.com', ...extra });

describe('PortalService', () => {
  describe('acceso a una orden de compra', () => {
    it('el cliente final no tiene acceso a órdenes', async () => {
      const { service } = montar();
      await expect(service.listar(u('cliente_final'), 'orden_compra', 'oc1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('el proveedor solo ve las suyas, ya emitidas; lo ajeno responde 404', async () => {
      const { service, prisma } = montar();
      prisma.purchaseOrder.findFirst.mockResolvedValue(null);
      await expect(service.listar(u('proveedor'), 'orden_compra', 'oc-ajena')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.purchaseOrder.findFirst.mock.calls[0][0].where).toEqual({ id: 'oc-ajena', tenantId: 't1', proveedorId: 'p1', estado: { not: 'borrador' } });
    });

    it('el equipo ve cualquier orden de su empresa (con borradores)', async () => {
      const { service, prisma } = montar();
      prisma.purchaseOrder.findFirst.mockResolvedValue({ numero: 'OC-1', proveedorId: 'p1' });
      await service.listar(u('operador'), 'orden_compra', 'oc1');
      expect(prisma.purchaseOrder.findFirst.mock.calls[0][0].where).toEqual({ id: 'oc1', tenantId: 't1' });
    });
  });

  describe('acceso a un envío', () => {
    it('el proveedor no tiene acceso a envíos', async () => {
      const { service } = montar();
      await expect(service.listar(u('proveedor'), 'envio', 's1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('el cliente final solo ve los envíos donde él es el destinatario, sin distinguir mayúsculas', async () => {
      const { service, prisma } = montar();
      prisma.shipment.findFirst.mockResolvedValue(null);
      await expect(service.listar(u('cliente_final', { email: 'Ana@Cliente.com' }), 'envio', 's-ajeno')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.shipment.findFirst.mock.calls[0][0].where).toEqual({
        id: 's-ajeno',
        tenantId: 't1',
        destinatarioEmail: { equals: 'Ana@Cliente.com', mode: 'insensitive' },
      });
    });
  });

  describe('listar', () => {
    it('no revela el rol del autor: solo si habló el equipo', async () => {
      const { service, prisma } = montar();
      prisma.purchaseOrder.findFirst.mockResolvedValue({ numero: 'OC-1', proveedorId: 'p1' });
      prisma.portalMessage.findMany.mockResolvedValue([
        { id: 'm1', texto: 'a', createdAt: new Date(), autor: { id: 'a', nombre: 'Ana', rol: 'admin_tenant' } },
        { id: 'm2', texto: 'b', createdAt: new Date(), autor: { id: 'b', nombre: 'Prov', rol: 'proveedor' } },
      ]);
      const r = await service.listar(u('operador'), 'orden_compra', 'oc1');
      expect(r.map((m) => m.delEquipo)).toEqual([true, false]);
      expect(JSON.stringify(r)).not.toContain('admin_tenant');
      expect(prisma.portalMessage.findMany.mock.calls[0][0].where).toEqual({ tenantId: 't1', entidadTipo: 'orden_compra', entidadId: 'oc1' });
    });
  });

  describe('publicar', () => {
    it('un mensaje vacío no se guarda', async () => {
      const { service, prisma } = montar();
      await expect(service.publicar(u('operador'), 'envio', 's1', '   ')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.portalMessage.create).not.toHaveBeenCalled();
    });

    it('guarda el texto sin espacios sobrantes, anota la bitácora y no deja escribir en lo ajeno', async () => {
      const { service, prisma, audit } = montar();
      prisma.shipment.findFirst.mockResolvedValue({ codigoGuia: 'G-1', destinatarioEmail: 'ana@c.com' });
      await service.publicar(u('operador'), 'envio', 's1', '  Hola  ');
      expect(prisma.portalMessage.create.mock.calls[0][0].data).toMatchObject({ tenantId: 't1', entidadTipo: 'envio', entidadId: 's1', autorId: 'u1', texto: 'Hola' });
      expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'portal.mensaje', metadata: { externo: false } }));

      prisma.shipment.findFirst.mockResolvedValue(null);
      prisma.portalMessage.create.mockClear();
      await expect(service.publicar(u('cliente_final'), 'envio', 's-ajeno', 'hola')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.portalMessage.create).not.toHaveBeenCalled();
    });

    it('si escribe un externo avisa a los administradores', async () => {
      const { service, prisma, notifications } = montar();
      prisma.purchaseOrder.findFirst.mockResolvedValue({ numero: 'OC-1', proveedorId: 'p1' });
      prisma.user.findMany
        .mockResolvedValueOnce([{ id: 'prov', email: 'prov@p.com' }]) // externos de la orden
        .mockResolvedValueOnce([{ id: 'adm', email: 'adm@e.com' }]); // administradores
      await service.publicar(u('proveedor', { userId: 'prov' }), 'orden_compra', 'oc1', 'Confirmo');
      expect(notifications.create).toHaveBeenCalledTimes(1);
      expect(notifications.create.mock.calls[0][1]).toMatchObject({ canal: 'email', tipo: 'portal_mensaje', destino: 'adm@e.com', userId: 'adm' });
      expect(prisma.user.findMany.mock.calls[1][0].where).toMatchObject({ tenantId: 't1', rol: 'admin_tenant', activo: true });
    });

    it('si escribe el equipo avisa a los externos de esa operación, no a sí mismo', async () => {
      const { service, prisma, notifications } = montar();
      prisma.purchaseOrder.findFirst.mockResolvedValue({ numero: 'OC-1', proveedorId: 'p1' });
      prisma.user.findMany.mockResolvedValueOnce([{ id: 'prov', email: 'prov@p.com' }]);
      await service.publicar(u('admin_tenant'), 'orden_compra', 'oc1', 'Urge');
      expect(notifications.create.mock.calls[0][1]).toMatchObject({ destino: 'prov@p.com' });
      expect(prisma.user.findMany.mock.calls[0][0].where).toMatchObject({ rol: 'proveedor', partnerId: 'p1', activo: true });
    });

    it('un correo que falla no rompe el mensaje', async () => {
      const { service, prisma, notifications } = montar();
      prisma.shipment.findFirst.mockResolvedValue({ codigoGuia: 'G-1', destinatarioEmail: 'ana@c.com' });
      prisma.user.findMany.mockResolvedValueOnce([{ id: 'cf', email: 'ana@c.com' }]);
      notifications.create.mockRejectedValue(new Error('SMTP caído'));
      await expect(service.publicar(u('operador'), 'envio', 's1', 'hola')).resolves.toBeDefined();
    });
  });

  describe('confirmarOrden (proveedor)', () => {
    const manana = () => new Date(Date.now() + 86_400_000).toISOString();

    it('solo se confirma una orden emitida', async () => {
      const { service, ordenes } = montar();
      ordenes.findOneDeProveedor.mockResolvedValue({ estado: 'confirmada', numero: 'OC-1' });
      await expect(service.confirmarOrden(u('proveedor'), 'oc1', manana())).rejects.toBeInstanceOf(BadRequestException);
      expect(ordenes.transicion).not.toHaveBeenCalled();
    });

    it('la fecha comprometida no puede estar en el pasado', async () => {
      const { service, ordenes } = montar();
      ordenes.findOneDeProveedor.mockResolvedValue({ estado: 'emitida', numero: 'OC-1' });
      await expect(service.confirmarOrden(u('proveedor'), 'oc1', new Date(Date.now() - 5 * 86_400_000).toISOString())).rejects.toBeInstanceOf(BadRequestException);
    });

    it('una orden ajena responde 404 antes de tocar nada', async () => {
      const { service, ordenes } = montar();
      ordenes.findOneDeProveedor.mockRejectedValue(new NotFoundException());
      await expect(service.confirmarOrden(u('proveedor'), 'oc-ajena', manana())).rejects.toBeInstanceOf(NotFoundException);
      expect(ordenes.transicion).not.toHaveBeenCalled();
      expect(ordenes.findOneDeProveedor).toHaveBeenCalledWith('t1', 'p1', 'oc-ajena');
    });

    it('confirma por la vía normal de la OC, deja bitácora y avisa a los administradores', async () => {
      const { service, ordenes, audit, prisma, notifications } = montar();
      ordenes.findOneDeProveedor.mockResolvedValueOnce({ estado: 'emitida', numero: 'OC-1' }).mockResolvedValueOnce({ estado: 'confirmada', numero: 'OC-1' });
      prisma.user.findMany.mockResolvedValueOnce([{ id: 'adm', email: 'adm@e.com' }]);
      const fecha = manana();
      const r = await service.confirmarOrden(u('proveedor'), 'oc1', fecha);
      expect(ordenes.transicion).toHaveBeenCalledWith('t1', 'oc1', { estado: 'confirmada', fechaConfirmadaProveedor: new Date(fecha).toISOString() });
      expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'portal.orden_confirmada', entidadId: 'oc1' }));
      expect(notifications.create).toHaveBeenCalledTimes(1);
      expect(r).toEqual({ estado: 'confirmada', numero: 'OC-1' });
    });
  });
});
