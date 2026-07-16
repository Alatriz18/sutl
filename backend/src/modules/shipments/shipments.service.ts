import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { TrackingEventsService } from '../tracking-events/tracking-events.service';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';

@Injectable()
export class ShipmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trackingEventsService: TrackingEventsService,
  ) {}

  findAll(tenantId: string) {
    return this.prisma.shipment.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const shipment = await this.prisma.shipment.findFirst({ where: { id, tenantId } });
    if (!shipment) {
      throw new NotFoundException('Envío no encontrado');
    }
    return shipment;
  }

  async create(tenantId: string, dto: CreateShipmentDto) {
    const codigoGuia = await this.generarCodigoGuia();
    return this.prisma.shipment.create({
      data: { ...dto, tenantId, codigoGuia },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateShipmentDto) {
    await this.findOne(tenantId, id);
    return this.prisma.shipment.update({ where: { id }, data: dto });
  }

  // Endpoint público (sin auth): un cliente final consulta su envío por
  // código de guía y ve el estado + histórico de eventos de tracking.
  async trackByCodigoGuia(codigoGuia: string) {
    const shipment = await this.prisma.shipment.findUnique({ where: { codigoGuia } });
    if (!shipment) {
      throw new NotFoundException('No existe un envío con ese código de guía');
    }

    const eventos = await this.trackingEventsService.findByCodigoGuia(codigoGuia);

    return {
      codigoGuia: shipment.codigoGuia,
      estado: shipment.estado,
      origen: shipment.origen,
      destino: shipment.destino,
      destinatarioNombre: shipment.destinatarioNombre,
      createdAt: shipment.createdAt,
      eventos,
    };
  }

  private async generarCodigoGuia(): Promise<string> {
    let codigo: string;
    let existe = true;
    do {
      codigo = `SUTL-${randomBytes(4).toString('hex').toUpperCase()}`;
      existe = (await this.prisma.shipment.count({ where: { codigoGuia: codigo } })) > 0;
    } while (existe);
    return codigo;
  }
}
