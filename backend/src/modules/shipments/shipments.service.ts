import { ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Booking, Partner } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { assertTenantRefs } from '../../common/tenant-refs';
import { TrackingEventsService } from '../tracking-events/tracking-events.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';

@Injectable()
export class ShipmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trackingEventsService: TrackingEventsService,
    @Optional() private readonly webhooks?: WebhooksService,
  ) {}

  private publicarCreado(envio: { codigoGuia: string; estado: string; tipo: string; modo: string; origen: string; destino: string; tenantId: string }) {
    void this.webhooks?.emitir(envio.tenantId, 'envio.creado', {
      codigoGuia: envio.codigoGuia,
      estado: envio.estado,
      tipo: envio.tipo,
      modo: envio.modo,
      origen: envio.origen,
      destino: envio.destino,
    });
  }

  findAll(tenantId: string) {
    return this.prisma.shipment.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: { carrier: true },
    });
  }

  async findOne(tenantId: string, id: string) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id, tenantId },
      include: {
        carrier: true,
        booking: true,
        // Carga de órdenes de compra que viaja en este embarque.
        ordenesCompraLineas: {
          where: { tenantId },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            cantidad: true,
            linea: {
              select: {
                id: true,
                sku: true,
                descripcion: true,
                unidad: true,
                cantidad: true,
                cantidadRecibida: true,
                purchaseOrder: {
                  select: { id: true, numero: true, estado: true, proveedor: { select: { nombre: true } } },
                },
              },
            },
          },
        },
      },
    });
    if (!shipment) {
      throw new NotFoundException('Envío no encontrado');
    }
    return shipment;
  }

  async create(tenantId: string, dto: CreateShipmentDto) {
    await assertTenantRefs(this.prisma, tenantId, { carrierId: dto.carrierId });
    const codigoGuia = await this.generarCodigoGuia();
    const creado = await this.prisma.shipment.create({
      data: { ...dto, tenantId, codigoGuia },
    });
    this.publicarCreado(creado);
    return creado;
  }

  async update(tenantId: string, id: string, dto: UpdateShipmentDto) {
    const anterior = await this.findOne(tenantId, id);
    await assertTenantRefs(this.prisma, tenantId, { carrierId: dto.carrierId });
    const actualizado = await this.prisma.shipment.update({ where: { id, tenantId }, data: dto });
    if (actualizado.estado !== anterior.estado) {
      void this.webhooks?.emitir(tenantId, 'envio.estado_cambiado', {
        codigoGuia: actualizado.codigoGuia,
        estadoAnterior: anterior.estado,
        estadoNuevo: actualizado.estado,
      });
    }
    return actualizado;
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

  // Usado por BookingsService al confirmar una reserva: crea el envío real y
  // lo enlaza 1:1 con el booking que le dio origen.
  async createFromBooking(tenantId: string, booking: Booking, cliente: Partner) {
    const yaConvertido = await this.prisma.shipment.findUnique({
      where: { bookingId: booking.id },
    });
    if (yaConvertido) {
      throw new ConflictException('Esta reserva ya fue convertida en un envío');
    }

    const codigoGuia = await this.generarCodigoGuia();
    const creado = await this.prisma.shipment.create({
      data: {
        tenantId,
        codigoGuia,
        tipo: booking.tipo,
        modo: booking.modo,
        carrierId: booking.carrierId,
        bookingId: booking.id,
        remitenteNombre: booking.tipo === 'exportacion' ? cliente.nombre : 'Por confirmar',
        destinatarioNombre: booking.tipo === 'exportacion' ? 'Por confirmar' : cliente.nombre,
        destinatarioEmail: cliente.email,
        origen: booking.origen,
        destino: booking.destino,
      },
    });
    this.publicarCreado(creado);
    return creado;
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
