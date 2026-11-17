import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PrismaService } from '../../prisma/prisma.service';
import { TrackingEvent, TrackingEventDocument } from './schemas/tracking-event.schema';
import { CreateTrackingEventDto } from './dto/create-tracking-event.dto';
import { TrackingStreamService } from './tracking-stream.service';

@Injectable()
export class TrackingEventsService {
  constructor(
    @InjectModel(TrackingEvent.name)
    private readonly trackingEventModel: Model<TrackingEventDocument>,
    private readonly prisma: PrismaService,
    private readonly stream: TrackingStreamService,
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
      where: { id: shipment.id, tenantId },
      data: { estado: dto.estado },
    });

    // Avisa en vivo a quienes tienen abierto el seguimiento de este envío.
    this.stream.publicar({
      tenantId,
      shipmentId: shipment.id,
      codigoGuia: shipment.codigoGuia,
      evento: {
        _id: String(evento._id),
        estado: evento.estado,
        ubicacion: evento.ubicacion,
        descripcion: evento.descripcion,
        lat: evento.lat,
        lng: evento.lng,
        timestamp: evento.timestamp,
      },
    });

    return evento;
  }

  // Para el cliente final: solo si el envío es suyo, y sin el correo del responsable interno.
  async findByShipmentParaCliente(tenantId: string, email: string, shipmentId: string): Promise<Record<string, unknown>[]> {
    const envio = await this.prisma.shipment.findFirst({
      where: { id: shipmentId, tenantId, destinatarioEmail: { equals: email, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!envio) throw new NotFoundException('Envío no encontrado');
    const eventos = await this.trackingEventModel.find({ tenantId, shipmentId }).sort({ timestamp: -1 }).lean();
    return eventos.map(({ responsable: _interno, ...publico }) => {
      void _interno;
      return publico;
    });
  }

  // Quién puede seguir en vivo un envío: el equipo de la empresa y el cliente final dueño del envío.
  async assertAccesoEnVivo(user: { tenantId: string; email: string; rol: string }, shipmentId: string) {
    const envio = await this.prisma.shipment.findFirst({
      where: {
        id: shipmentId,
        tenantId: user.tenantId,
        ...(user.rol === 'cliente_final' ? { destinatarioEmail: { equals: user.email, mode: 'insensitive' as const } } : {}),
      },
      select: { id: true },
    });
    if (!envio) throw new NotFoundException('Envío no encontrado');
  }

  // Seguimiento en vivo del equipo y del cliente final dueño. El aviso no lleva el correo del responsable.
  streamEnvio(user: { tenantId: string }, shipmentId: string) {
    return this.stream.suscribir(
      (e) => e.tenantId === user.tenantId && e.shipmentId === shipmentId,
      (e) => ({ ...e.evento, shipmentId }),
    );
  }

  // Seguimiento en vivo de la ruta pública: solo lo que el destinatario ve en la página.
  streamPublico(codigoGuia: string) {
    return this.stream.suscribir(
      (e) => e.codigoGuia === codigoGuia,
      (e) => ({ ...e.evento }),
    );
  }

  hayCupoEnVivo() {
    return this.stream.hayCupo();
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
