import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(tenantId: string) {
    return this.prisma.notification.findMany({
      where: { tenantId },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(tenantId: string, dto: CreateNotificationDto) {
    return this.prisma.notification.create({
      data: { ...dto, tenantId },
      include: { user: true },
    });
  }

  // No hay proveedor real conectado (SES/FCM/Twilio) todavía: esto simula el
  // resultado de ese envío para que el flujo completo (pendiente → enviado)
  // sea probable de punta a punta antes de conectar el proveedor real.
  async marcarEnviada(tenantId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({ where: { id, tenantId } });
    if (!notification) {
      throw new NotFoundException('Notificación no encontrada');
    }
    return this.prisma.notification.update({
      where: { id },
      data: { estado: 'enviado', enviadoAt: new Date() },
    });
  }
}
