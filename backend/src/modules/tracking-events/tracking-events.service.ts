import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PrismaService } from '../../prisma/prisma.service';
import { TrackingEvent, TrackingEventDocument } from './schemas/tracking-event.schema';
import { CreateTrackingEventDto } from './dto/create-tracking-event.dto';

@Injectable()
export class TrackingEventsService {
  constructor(
    @InjectModel(TrackingEvent.name)
    private readonly trackingEventModel: Model<TrackingEventDocument>,
    private readonly prisma: PrismaService,
  ) {}

  async create(tenantId: string, responsable: string, dto: CreateTrackingEventDto) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id: dto.shipmentId, tenantId },
    });
    if (!shipment) {
      throw new NotFoundException('Envío no encontrado para este tenant');
    }

    const evento = await this.trackingEventModel.create({
      shipmentId: shipment.id,
      tenantId,
      codigoGuia: shipment.codigoGuia,
      estado: dto.estado,
      ubicacion: dto.ubicacion,
      descripcion: dto.descripcion,
      lat: dto.lat,
      lng: dto.lng,
      responsable,
      timestamp: new Date(),
    });

    // El estado del envío en Postgres refleja el último evento registrado.
    await this.prisma.shipment.update({
      where: { id: shipment.id },
      data: { estado: dto.estado },
    });

    return evento;
  }

  findByShipment(tenantId: string, shipmentId: string) {
    return this.trackingEventModel
      .find({ tenantId, shipmentId })
      .sort({ timestamp: -1 })
      .lean();
  }

  // Usado por el endpoint público de tracking — no filtra por tenantId porque
  // el código de guía ya es el identificador público entregado al cliente final.
  findByCodigoGuia(codigoGuia: string) {
    return this.trackingEventModel.find({ codigoGuia }).sort({ timestamp: -1 }).lean();
  }
}
