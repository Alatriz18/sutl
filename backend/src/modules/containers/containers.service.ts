import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateContainerDto } from './dto/create-container.dto';
import { UpdateContainerDto } from './dto/update-container.dto';

@Injectable()
export class ContainersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(tenantId: string) {
    return this.prisma.container.findMany({
      where: { tenantId },
      include: { carrier: true, envios: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const container = await this.prisma.container.findFirst({
      where: { id, tenantId },
      include: { carrier: true, envios: true },
    });
    if (!container) {
      throw new NotFoundException('Contenedor no encontrado');
    }
    return container;
  }

  create(tenantId: string, dto: CreateContainerDto) {
    return this.prisma.container.create({
      data: { ...dto, tenantId },
      include: { carrier: true },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateContainerDto) {
    await this.findOne(tenantId, id);
    return this.prisma.container.update({
      where: { id },
      data: dto,
      include: { carrier: true, envios: true },
    });
  }

  // Agrega un envío existente del tenant a este contenedor (consolidación).
  async asignarEnvio(tenantId: string, id: string, shipmentId: string) {
    await this.findOne(tenantId, id);
    const shipment = await this.prisma.shipment.findFirst({
      where: { id: shipmentId, tenantId },
    });
    if (!shipment) {
      throw new NotFoundException('Envío no encontrado para este tenant');
    }
    await this.prisma.shipment.update({ where: { id: shipmentId }, data: { containerId: id } });
    return this.findOne(tenantId, id);
  }
}
