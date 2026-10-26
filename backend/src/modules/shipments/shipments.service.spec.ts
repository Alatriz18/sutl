import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { TrackingEventsService } from '../tracking-events/tracking-events.service';
import { ShipmentsService } from './shipments.service';

// Prueba unitaria con Prisma mockeado: no toca la base de datos, verifica
// la lógica de aislamiento por tenant a nivel de servicio (complementa, no
// reemplaza, el e2e de test/tenant-isolation.e2e-spec.ts).
describe('ShipmentsService', () => {
  let service: ShipmentsService;
  let prisma: {
    shipment: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      shipment: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ShipmentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: TrackingEventsService, useValue: { findByCodigoGuia: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(ShipmentsService);
  });

  it('findAll filtra siempre por tenantId', async () => {
    prisma.shipment.findMany.mockResolvedValue([]);

    await service.findAll('tenant-a');

    expect(prisma.shipment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-a' } }),
    );
  });

  it('findOne lanza NotFoundException si el envío no pertenece al tenant', async () => {
    prisma.shipment.findFirst.mockResolvedValue(null);

    await expect(service.findOne('tenant-a', 'shipment-de-otro-tenant')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.shipment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'shipment-de-otro-tenant', tenantId: 'tenant-a' } }),
    );
  });

  it('update repite tenantId en el where del update, no solo en el chequeo previo', async () => {
    prisma.shipment.findFirst.mockResolvedValue({ id: 's1', tenantId: 'tenant-a' });
    prisma.shipment.update.mockResolvedValue({ id: 's1', destino: 'Nuevo destino' });

    await service.update('tenant-a', 's1', { destino: 'Nuevo destino' });

    expect(prisma.shipment.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 's1', tenantId: 'tenant-a' } }),
    );
  });
});
