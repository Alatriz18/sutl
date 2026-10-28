import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { PurchaseOrdersService, TRANSICIONES } from './purchase-orders.service';

// Prueba unitaria con Prisma mockeado: cubre las reglas de negocio de la OC
// (máquina de estados, recepciones, proveedor del mismo tenant). El flujo real
// contra Postgres está en test/purchase-orders.e2e-spec.ts.
describe('PurchaseOrdersService', () => {
  let service: PurchaseOrdersService;
  let prisma: {
    purchaseOrder: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      updateMany: jest.Mock;
    };
    purchaseOrderLine: { updateMany: jest.Mock; findMany: jest.Mock };
    purchaseOrderReceipt: { create: jest.Mock };
    partner: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };

  const ordenBase = {
    id: 'oc-1',
    tenantId: 'tenant-a',
    estado: 'borrador',
    fechaConfirmadaProveedor: null,
    lineas: [{ id: 'linea-1', sku: 'RES-001', cantidad: 100, cantidadRecibida: 0 }],
  };

  beforeEach(async () => {
    prisma = {
      purchaseOrder: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      purchaseOrderLine: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn(),
      },
      purchaseOrderReceipt: { create: jest.fn() },
      partner: { findFirst: jest.fn() },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(prisma));

    const moduleRef = await Test.createTestingModule({
      providers: [PurchaseOrdersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(PurchaseOrdersService);
  });

  it('findAll filtra siempre por tenantId', async () => {
    prisma.purchaseOrder.findMany.mockResolvedValue([]);
    await service.findAll('tenant-a', { estado: 'emitida' });
    expect(prisma.purchaseOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-a', estado: 'emitida' } }),
    );
  });

  it('findOne lanza NotFoundException si la OC no pertenece al tenant', async () => {
    prisma.purchaseOrder.findFirst.mockResolvedValue(null);
    await expect(service.findOne('tenant-a', 'oc-de-otro')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.purchaseOrder.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'oc-de-otro', tenantId: 'tenant-a' } }),
    );
  });

  it('create rechaza un proveedor que no es del tenant o no es tipo proveedor', async () => {
    prisma.partner.findFirst.mockResolvedValue(null);
    await expect(
      service.create('tenant-a', 'user-1', {
        numero: 'OC-1',
        proveedorId: 'partner-de-otro-tenant',
        lineas: [{ sku: 'X', descripcion: 'X', cantidad: 1 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.partner.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'partner-de-otro-tenant', tenantId: 'tenant-a', tipo: 'proveedor' }),
      }),
    );
    expect(prisma.purchaseOrder.create).not.toHaveBeenCalled();
  });

  it('las líneas creadas heredan el tenantId de la OC', async () => {
    prisma.partner.findFirst.mockResolvedValue({ id: 'prov-1' });
    prisma.purchaseOrder.create.mockResolvedValue({ id: 'oc-1' });
    await service.create('tenant-a', 'user-1', {
      numero: 'OC-1',
      proveedorId: 'prov-1',
      lineas: [{ sku: ' RES-001 ', descripcion: 'Resina', cantidad: 10 }],
    });
    const data = prisma.purchaseOrder.create.mock.calls[0][0].data;
    expect(data.tenantId).toBe('tenant-a');
    expect(data.creadoPorId).toBe('user-1');
    expect(data.lineas.create[0]).toEqual(expect.objectContaining({ tenantId: 'tenant-a', sku: 'RES-001' }));
  });

  describe('transicion', () => {
    it('no permite saltar de borrador a despachada', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue(ordenBase);
      await expect(
        service.transicion('tenant-a', 'oc-1', { estado: 'despachada' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.purchaseOrder.updateMany).not.toHaveBeenCalled();
    });

    it('confirmar exige la fecha comprometida por el proveedor', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue({ ...ordenBase, estado: 'emitida' });
      await expect(
        service.transicion('tenant-a', 'oc-1', { estado: 'confirmada' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('cancelar exige motivo', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue(ordenBase);
      await expect(
        service.transicion('tenant-a', 'oc-1', { estado: 'cancelada' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('escribe con tenantId y estado actual en el where (control de concurrencia)', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue(ordenBase);
      await service.transicion('tenant-a', 'oc-1', { estado: 'emitida' });
      expect(prisma.purchaseOrder.updateMany).toHaveBeenCalledWith({
        where: { id: 'oc-1', tenantId: 'tenant-a', estado: 'borrador' },
        data: { estado: 'emitida' },
      });
    });

    it('responde 409 si otra petición cambió el estado antes', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue(ordenBase);
      prisma.purchaseOrder.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        service.transicion('tenant-a', 'oc-1', { estado: 'emitida' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('recibida y cancelada son estados finales', () => {
      expect(TRANSICIONES.recibida).toEqual([]);
      expect(TRANSICIONES.cancelada).toEqual([]);
    });
  });

  describe('registrarRecepcion', () => {
    const despachada = { ...ordenBase, estado: 'despachada' };

    it('no permite recibir una OC en borrador', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue(ordenBase);
      await expect(
        service.registrarRecepcion('tenant-a', 'user-1', 'oc-1', {
          lineas: [{ lineaId: 'linea-1', cantidad: 10 }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza líneas que no pertenecen a la OC', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue(despachada);
      await expect(
        service.registrarRecepcion('tenant-a', 'user-1', 'oc-1', {
          lineas: [{ lineaId: 'linea-de-otra-oc', cantidad: 10 }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rechaza recibir más de lo pendiente (incremento condicional sin filas afectadas)', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue(despachada);
      prisma.purchaseOrderLine.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        service.registrarRecepcion('tenant-a', 'user-1', 'oc-1', {
          lineas: [{ lineaId: 'linea-1', cantidad: 150 }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.purchaseOrderReceipt.create).not.toHaveBeenCalled();
    });

    it('recepción parcial deja la OC en recibida_parcial', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue(despachada);
      prisma.purchaseOrderLine.findMany.mockResolvedValue([{ cantidad: 100, cantidadRecibida: 40 }]);
      await service.registrarRecepcion('tenant-a', 'user-1', 'oc-1', {
        lineas: [{ lineaId: 'linea-1', cantidad: 40 }],
      });
      expect(prisma.purchaseOrderLine.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'linea-1', tenantId: 'tenant-a', purchaseOrderId: 'oc-1' }),
        }),
      );
      expect(prisma.purchaseOrder.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { estado: 'recibida_parcial' } }),
      );
    });

    it('recepción completa cierra la OC como recibida', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue(despachada);
      prisma.purchaseOrderLine.findMany.mockResolvedValue([{ cantidad: 100, cantidadRecibida: 100 }]);
      await service.registrarRecepcion('tenant-a', 'user-1', 'oc-1', {
        lineas: [{ lineaId: 'linea-1', cantidad: 100 }],
      });
      expect(prisma.purchaseOrder.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { estado: 'recibida' } }),
      );
    });
  });
});
