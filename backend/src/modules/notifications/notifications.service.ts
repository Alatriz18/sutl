import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Inject, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { CanalNotificacion } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { assertTenantRefs } from '../../common/tenant-refs';
import { COLA_NOTIFICACIONES } from '../queues/queues.constants';
import { CreateNotificationDto } from './dto/create-notification.dto';
import {
  CANAL_EMAIL,
  CANAL_WHATSAPP,
  CanalEnvio,
  EMAIL_RE,
  ErrorDefinitivo,
  TELEFONO_RE,
  mensajeSeguro,
} from './channels/channel';

export const TRABAJO_ENVIAR = 'enviar';
export const MAX_INTENTOS = 3;

const INCLUIR_USUARIO = { user: { select: { id: true, nombre: true, email: true } } } as const;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CANAL_EMAIL) private readonly email: CanalEnvio,
    @Inject(CANAL_WHATSAPP) private readonly whatsapp: CanalEnvio,
    @Optional() @InjectQueue(COLA_NOTIFICACIONES) private readonly cola?: Queue,
  ) {}

  findAll(tenantId: string) {
    return this.prisma.notification.findMany({
      where: { tenantId },
      include: INCLUIR_USUARIO,
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  // Qué canales están realmente conectados en este servidor.
  canales() {
    return { email: this.email.disponible, whatsapp: this.whatsapp.disponible, push: false, sms: false };
  }

  async create(tenantId: string, dto: CreateNotificationDto) {
    if (dto.canal === 'push' || dto.canal === 'sms') {
      throw new BadRequestException(`El canal ${dto.canal} todavía no está disponible. Usa correo o WhatsApp.`);
    }
    const canal = this.canalDe(dto.canal);
    if (!canal.disponible) {
      throw new BadRequestException(
        dto.canal === 'email'
          ? 'El envío por correo no está configurado en el servidor.'
          : 'El envío por WhatsApp no está configurado en el servidor.',
      );
    }
    await assertTenantRefs(this.prisma, tenantId, { userId: dto.userId });

    // Destino: el indicado, o el correo del usuario destinatario (solo correo).
    let destino = dto.destino?.trim() || null;
    if (!destino && dto.userId && dto.canal === 'email') {
      const user = await this.prisma.user.findFirst({ where: { id: dto.userId, tenantId }, select: { email: true } });
      destino = user?.email ?? null;
    }
    if (!destino) {
      throw new BadRequestException(
        dto.canal === 'email'
          ? 'Indica un correo de destino o elige un usuario.'
          : 'Indica el teléfono de destino en formato internacional (+593…).',
      );
    }
    if (dto.canal === 'email' && !EMAIL_RE.test(destino)) {
      throw new BadRequestException('El correo de destino no es válido.');
    }
    if (dto.canal === 'whatsapp' && !TELEFONO_RE.test(destino)) {
      throw new BadRequestException('El teléfono debe estar en formato internacional, por ejemplo +593991234567.');
    }

    const creada = await this.prisma.notification.create({
      data: {
        canal: dto.canal,
        tipo: dto.tipo,
        asunto: dto.asunto,
        mensaje: dto.mensaje,
        userId: dto.userId,
        destino,
        tenantId,
      },
    });
    await this.despachar(creada.id, tenantId);
    return this.prisma.notification.findFirst({ where: { id: creada.id, tenantId }, include: INCLUIR_USUARIO });
  }

  // Una notificación fallida se puede volver a enviar a mano.
  async reenviar(tenantId: string, id: string) {
    const n = await this.prisma.notification.findFirst({ where: { id, tenantId } });
    if (!n) throw new NotFoundException('Notificación no encontrada');
    if (n.estado !== 'fallido') {
      throw new BadRequestException('Solo se puede reenviar una notificación fallida.');
    }
    // Atómico: dos clics seguidos no encolan dos envíos.
    const { count } = await this.prisma.notification.updateMany({
      where: { id, tenantId, estado: 'fallido' },
      data: { estado: 'pendiente', error: null },
    });
    if (count === 0) throw new BadRequestException('La notificación ya cambió de estado.');
    await this.despachar(id, tenantId);
    return this.prisma.notification.findFirst({ where: { id, tenantId }, include: INCLUIR_USUARIO });
  }

  // Con Redis: a la cola (la API no espera al proveedor y hay reintentos).
  // Sin Redis: se envía en el momento.
  private async despachar(id: string, tenantId: string) {
    if (this.cola) {
      await this.cola.add(TRABAJO_ENVIAR, { tenantId, notificationId: id });
      return;
    }
    await this.enviar(tenantId, id, true).catch((e) => this.logger.warn(`Envío inline fallido: ${(e as Error).message}`));
  }

  // Lo llama el procesador de la cola (y el modo sin Redis). `ultimoIntento`
  // decide si un fallo deja la notificación en "fallido" o sigue "pendiente"
  // a la espera del siguiente reintento. Si lanza, la cola reintenta.
  async enviar(tenantId: string, id: string, ultimoIntento: boolean) {
    const n = await this.prisma.notification.findFirst({ where: { id, tenantId } });
    // Idempotente: un reintento tardío de algo ya enviado no lo duplica.
    if (!n || n.estado === 'enviado') return;

    const canal = this.canalDe(n.canal);
    await this.prisma.notification.updateMany({ where: { id, tenantId }, data: { intentos: { increment: 1 } } });
    try {
      if (!n.destino) throw new ErrorDefinitivo('La notificación no tiene destino.');
      await canal.enviar({ destino: n.destino, asunto: n.asunto, mensaje: n.mensaje });
      await this.prisma.notification.updateMany({
        where: { id, tenantId },
        data: { estado: 'enviado', enviadoAt: new Date(), error: null },
      });
    } catch (e) {
      const termina = e instanceof ErrorDefinitivo || ultimoIntento;
      await this.prisma.notification.updateMany({
        where: { id, tenantId },
        data: { estado: termina ? 'fallido' : 'pendiente', error: mensajeSeguro(e) },
      });
      throw e;
    }
  }

  private canalDe(canal: CanalNotificacion): CanalEnvio {
    return canal === 'whatsapp' ? this.whatsapp : this.email;
  }
}
