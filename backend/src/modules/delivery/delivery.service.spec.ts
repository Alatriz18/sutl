import { mkdtempSync, writeFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RequestUser } from '../../common/interfaces/jwt-payload.interface';
import { DeliveryService } from './delivery.service';

const user = (rol: RequestUser['rol'] = 'operador', extra: Partial<RequestUser> = {}): RequestUser => ({ userId: 'u1', tenantId: 't1', rol, email: 'op@x.com', ...extra });

function montar() {
  const prisma = {
    shipment: { findFirst: jest.fn().mockResolvedValue({ id: 's1', codigoGuia: 'G-1', destino: 'Quito' }) },
    proofOfDelivery: {
      create: jest.fn().mockResolvedValue({ id: 'pod1' }),
      findFirst: jest.fn().mockResolvedValue(null),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    shipmentPurchaseOrderLine: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const tracking = { create: jest.fn().mockResolvedValue({}) };
  const ordenes = { registrarRecepcion: jest.fn().mockResolvedValue({}) };
  const audit = { registrar: jest.fn().mockResolvedValue(undefined) };
  const service = new DeliveryService(prisma as never, tracking as never, ordenes as never, audit as never);
  return { service, prisma, tracking, ordenes, audit };
}

const dto = { receptorNombre: '  Ana Pérez ' };

describe('DeliveryService', () => {
  describe('acceso', () => {
    it('el cliente final solo accede a envíos donde él es el destinatario', async () => {
      const { service, prisma } = montar();
      prisma.shipment.findFirst.mockResolvedValue(null);
      await expect(service.obtener(user('cliente_final', { email: 'Ana@C.com' }), 's-ajeno')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.shipment.findFirst.mock.calls[0][0].where).toEqual({
        id: 's-ajeno',
        tenantId: 't1',
        destinatarioEmail: { equals: 'Ana@C.com', mode: 'insensitive' },
      });
    });

    it('el equipo ve cualquier envío de su empresa', async () => {
      const { service, prisma } = montar();
      await service.obtener(user('operador'), 's1');
      expect(prisma.shipment.findFirst.mock.calls[0][0].where).toEqual({ id: 's1', tenantId: 't1' });
    });

    it('obtener sin prueba devuelve null; con prueba no expone la ruta del archivo', async () => {
      const { service, prisma } = montar();
      await expect(service.obtener(user(), 's1')).resolves.toBeNull();
      prisma.proofOfDelivery.findFirst.mockResolvedValue({ id: 'p', receptorNombre: 'Ana', archivoUrl: '/uploads/t1/x.pdf', archivoNombre: 'x.pdf' });
      const r = await service.obtener(user(), 's1');
      expect(r).toMatchObject({ tieneArchivo: true });
      expect(JSON.stringify(r)).not.toContain('/uploads/');
    });

    it('la evidencia solo se sirve si existe', async () => {
      const { service, prisma } = montar();
      prisma.proofOfDelivery.findFirst.mockResolvedValue({ archivoUrl: null, archivoNombre: null });
      await expect(service.archivo(user(), 's1')).rejects.toBeInstanceOf(NotFoundException);
      prisma.proofOfDelivery.findFirst.mockResolvedValue({ archivoUrl: '/uploads/t1/x.pdf', archivoNombre: 'x.pdf' });
      await expect(service.archivo(user(), 's1')).resolves.toEqual({ ruta: '/uploads/t1/x.pdf', nombre: 'x.pdf' });
    });
  });

  describe('registrar', () => {
    it('guarda la prueba, deja el envío en «entregado» por el seguimiento y anota la bitácora', async () => {
      const { service, prisma, tracking, audit } = montar();
      const rutaJpg = join(mkdtempSync(join(tmpdir(), 'evid-')), 'pod-1.jpg');
      writeFileSync(rutaJpg, Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('datos')]));
      await service.registrar(user(), 's1', dto, { filename: 'pod-1.jpg', originalname: 'firma.jpg', path: rutaJpg });
      expect(prisma.proofOfDelivery.create.mock.calls[0][0].data).toMatchObject({
        tenantId: 't1', shipmentId: 's1', receptorNombre: 'Ana Pérez', archivoUrl: '/uploads/t1/pod-1.jpg', archivoNombre: 'firma.jpg', registradoPorId: 'u1',
      });
      expect(tracking.create).toHaveBeenCalledWith('t1', 'op@x.com', expect.objectContaining({ shipmentId: 's1', estado: 'entregado', ubicacion: 'Quito' }));
      expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'pod.registrado', entidadId: 's1' }));
    });

    it('guarda la firma en pantalla cuando es un PNG real', async () => {
      const { service, prisma } = montar();
      const ruta = join(mkdtempSync(join(tmpdir(), 'firma-')), 'firma.png');
      writeFileSync(ruta, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('datos')]));
      await service.registrar(user(), 's1', dto, undefined, { filename: 'pod-9.png', path: ruta });
      expect(prisma.proofOfDelivery.create.mock.calls[0][0].data).toMatchObject({ firmaUrl: '/uploads/t1/pod-9.png' });
    });

    it('rechaza una evidencia cuyo contenido no es del tipo que dice su extensión, la borra y no registra nada', async () => {
      const { service, prisma } = montar();
      const ruta = join(mkdtempSync(join(tmpdir(), 'evid-')), 'pod-2.pdf');
      writeFileSync(ruta, 'MZ ejecutable disfrazado');
      await expect(service.registrar(user(), 's1', dto, { filename: 'pod-2.pdf', originalname: 'acta.pdf', path: ruta })).rejects.toBeInstanceOf(BadRequestException);
      expect(existsSync(ruta)).toBe(false);
      expect(prisma.proofOfDelivery.create).not.toHaveBeenCalled();
    });

    it('rechaza una «firma» que no es un PNG (aunque se llame .png), la borra y no registra nada', async () => {
      const { service, prisma, tracking } = montar();
      const ruta = join(mkdtempSync(join(tmpdir(), 'firma-')), 'falsa.png');
      writeFileSync(ruta, '<?php echo 1; ?>');
      await expect(service.registrar(user(), 's1', dto, undefined, { filename: 'pod-9.png', path: ruta })).rejects.toBeInstanceOf(BadRequestException);
      expect(existsSync(ruta)).toBe(false);
      expect(prisma.proofOfDelivery.create).not.toHaveBeenCalled();
      expect(tracking.create).not.toHaveBeenCalled();
    });

    it('la firma solo se sirve si existe', async () => {
      const { service, prisma } = montar();
      prisma.proofOfDelivery.findFirst.mockResolvedValue({ firmaUrl: null });
      await expect(service.firma(user(), 's1')).rejects.toBeInstanceOf(NotFoundException);
      prisma.proofOfDelivery.findFirst.mockResolvedValue({ firmaUrl: '/uploads/t1/f.png' });
      await expect(service.firma(user(), 's1')).resolves.toEqual({ ruta: '/uploads/t1/f.png' });
    });

    it('una segunda prueba para el mismo envío da 409 y no registra otro evento', async () => {
      const { service, prisma, tracking } = montar();
      prisma.proofOfDelivery.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }));
      await expect(service.registrar(user(), 's1', dto)).rejects.toBeInstanceOf(ConflictException);
      expect(tracking.create).not.toHaveBeenCalled();
    });

    it('no se entrega en el futuro', async () => {
      const { service, prisma } = montar();
      await expect(service.registrar(user(), 's1', { ...dto, entregadoAt: new Date(Date.now() + 5 * 86_400_000).toISOString() })).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.proofOfDelivery.create).not.toHaveBeenCalled();
    });

    it('si el evento de seguimiento falla, la prueba se deshace (no queda a medias)', async () => {
      const { service, prisma, tracking } = montar();
      tracking.create.mockRejectedValue(new Error('Mongo caído'));
      await expect(service.registrar(user(), 's1', dto)).rejects.toThrow('Mongo caído');
      expect(prisma.proofOfDelivery.deleteMany).toHaveBeenCalledWith({ where: { id: 'pod1', tenantId: 't1' } });
    });

    it('sin pedirlo no toca las órdenes de compra', async () => {
      const { service, prisma, ordenes } = montar();
      const r = await service.registrar(user(), 's1', dto);
      expect(prisma.shipmentPurchaseOrderLine.findMany).not.toHaveBeenCalled();
      expect(ordenes.registrarRecepcion).not.toHaveBeenCalled();
      expect(r.recepciones).toEqual([]);
    });
  });

  describe('recepción de las órdenes de compra', () => {
    const vinculo = (ocId: string, numero: string, lineaId: string, viaja: number, cantidad: number, recibida: number) => ({
      cantidad: viaja,
      linea: { id: lineaId, cantidad, cantidadRecibida: recibida, purchaseOrder: { id: ocId, numero } },
    });

    it('recibe por OC lo que viajaba, sin pasar de lo que falta', async () => {
      const { service, prisma, ordenes } = montar();
      prisma.shipmentPurchaseOrderLine.findMany.mockResolvedValue([
        vinculo('oc1', 'OC-1', 'l1', 60, 100, 0),
        vinculo('oc1', 'OC-1', 'l2', 50, 50, 30), // faltan 20: se recibe 20
        vinculo('oc2', 'OC-2', 'l3', 10, 10, 10), // ya recibida: se omite
      ]);
      const r = await service.registrar(user(), 's1', { ...dto, recibirOc: true });
      expect(prisma.shipmentPurchaseOrderLine.findMany.mock.calls[0][0].where).toEqual({ tenantId: 't1', shipmentId: 's1' });
      expect(ordenes.registrarRecepcion).toHaveBeenCalledTimes(1);
      expect(ordenes.registrarRecepcion).toHaveBeenCalledWith('t1', 'u1', 'oc1', expect.objectContaining({ lineas: [{ lineaId: 'l1', cantidad: 60 }, { lineaId: 'l2', cantidad: 20 }] }));
      expect(r.recepciones).toEqual([{ numero: 'OC-1', ok: true }]);
    });

    it('pasa las reglas de inventario de la recepción normal', async () => {
      const { service, prisma, ordenes } = montar();
      prisma.shipmentPurchaseOrderLine.findMany.mockResolvedValue([vinculo('oc1', 'OC-1', 'l1', 5, 10, 0)]);
      await service.registrar(user(), 's1', { ...dto, recibirOc: true, warehouseId: 'w1', actualizarInventario: true });
      expect(ordenes.registrarRecepcion.mock.calls[0][3]).toMatchObject({ warehouseId: 'w1', actualizarInventario: true });
    });

    it('si una OC no se puede recibir, las demás siguen y la prueba queda registrada', async () => {
      const { service, prisma, ordenes } = montar();
      prisma.shipmentPurchaseOrderLine.findMany.mockResolvedValue([vinculo('oc1', 'OC-1', 'l1', 5, 10, 0), vinculo('oc2', 'OC-2', 'l2', 5, 10, 0)]);
      ordenes.registrarRecepcion.mockRejectedValueOnce(new BadRequestException('No se puede registrar recepción en una OC emitida')).mockResolvedValueOnce({});
      const r = await service.registrar(user(), 's1', { ...dto, recibirOc: true });
      expect(r.recepciones).toEqual([{ numero: 'OC-1', ok: false, error: 'No se puede registrar recepción en una OC emitida' }, { numero: 'OC-2', ok: true }]);
      expect(prisma.proofOfDelivery.deleteMany).not.toHaveBeenCalled();
    });
  });
});
