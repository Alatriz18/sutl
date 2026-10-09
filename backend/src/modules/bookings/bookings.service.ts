import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ShipmentsService } from '../shipments/shipments.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shipmentsService: ShipmentsService,
  ) {}

  findAll(tenantId: string) {
    return this.prisma.booking.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: { cliente: true, carrier: true, shipment: true },
    });
  }

  async findOne(tenantId: string, id: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, tenantId },
      include: { cliente: true, carrier: true, shipment: true },
    });
    if (!booking) {
      throw new NotFoundException('Reserva no encontrada');
    }
    return booking;
  }

  create(tenantId: string, dto: CreateBookingDto) {
    return this.prisma.booking.create({
      data: { ...dto, tenantId },
      include: { cliente: true, carrier: true },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateBookingDto) {
    await this.findOne(tenantId, id);
    return this.prisma.booking.update({
      where: { id },
      data: dto,
      include: { cliente: true, carrier: true },
    });
  }

  // Confirma la reserva creando el Shipment real y enlazándolo 1:1.
  async convertirAEnvio(tenantId: string, id: string) {
    const booking = await this.findOne(tenantId, id);
    const shipment = await this.shipmentsService.createFromBooking(
      tenantId,
      booking,
      booking.cliente,
    );
    await this.prisma.booking.update({ where: { id }, data: { estado: 'convertida' } });
    if (booking.quoteId) {
      await this.prisma.quote.update({
        where: { id: booking.quoteId },
        data: { estado: 'convertida' },
      });
    }
    return shipment;
  }
}
