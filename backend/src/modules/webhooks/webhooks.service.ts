import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit, Optional } from '@nestjs/common';
import { Queue } from 'bullmq';
import { randomBytes } from 'crypto';
import { cifrar, claveDeCifradoConfigurada, descifrar } from '../../common/crypto';
import { UrlDestinoInvalida, validarUrlDestino } from '../../common/url-destino';
import { PrismaService } from '../../prisma/prisma.service';
import { ErrorDefinitivo } from '../notifications/channels/channel';
import { COLA_WEBHOOKS } from '../queues/queues.constants';
import { CreateWebhookDto, UpdateWebhookDto } from './dto/webhook.dto';
import { EVENTO_PRUEBA, firmarEntrega } from './webhook-events';

export const TRABAJO_ENTREGAR = 'entregar';
export const MAX_INTENTOS_WEBHOOK = 5;
const MAX_ENDPOINTS_POR_EMPRESA = 10;
const TIMEOUT_MS = 10_000;

// Solo desarrollo y pruebas: permite http y direcciones locales.
const permitirPrivadas = () => process.env.WEBHOOKS_ALLOW_PRIVATE === 'true' && process.env.NODE_ENV !== 'production';

// Lo que se devuelve de un webhook: nunca el secreto cifrado.
const PUBLICO = {
  id: true,
  url: true,
  eventos: true,
  activo: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class WebhooksService implements OnModuleInit {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @InjectQueue(COLA_WEBHOOKS) private readonly cola?: Queue,
  ) {}

  onModuleInit() {
    // En producción sin clave de cifrado no se podrían firmar entregas: mejor no arrancar.
    if (process.env.NODE_ENV === 'production' && !claveDeCifradoConfigurada()) {
      throw new Error('ENCRYPTION_KEY es obligatoria en producción (openssl rand -base64 32).');
    }
  }

  async listar(tenantId: string) {
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: { tenantId },
      select: PUBLICO,
      orderBy: { createdAt: 'desc' },
    });
    // Última entrega de cada uno, para mostrar su salud de un vistazo.
    const ultimas = await Promise.all(
      endpoints.map((e) =>
        this.prisma.webhookDelivery.findFirst({
          where: { endpointId: e.id, tenantId },
          orderBy: { createdAt: 'desc' },
          select: { estado: true, createdAt: true, entregadoAt: true },
        }),
      ),
    );
    return endpoints.map((e, i) => ({ ...e, ultimaEntrega: ultimas[i] }));
  }

  async crear(tenantId: string, dto: CreateWebhookDto) {
    await this.validarUrl(dto.url);
    const total = await this.prisma.webhookEndpoint.count({ where: { tenantId } });
    if (total >= MAX_ENDPOINTS_POR_EMPRESA) {
      throw new BadRequestException(`Se alcanzó el máximo de ${MAX_ENDPOINTS_POR_EMPRESA} webhooks por empresa.`);
    }
    const secreto = `whsec_${randomBytes(24).toString('base64url')}`;
    const creado = await this.prisma.webhookEndpoint.create({
      data: { tenantId, url: dto.url, eventos: dto.eventos, secretCifrado: cifrar(secreto) },
      select: PUBLICO,
    });
    // El secreto se muestra una sola vez: quien integra lo necesita para verificar la firma.
    return { ...creado, secreto };
  }

  async actualizar(tenantId: string, id: string, dto: UpdateWebhookDto) {
    if (dto.url !== undefined) await this.validarUrl(dto.url);
    const { count } = await this.prisma.webhookEndpoint.updateMany({
      where: { id, tenantId },
      data: { url: dto.url, eventos: dto.eventos, activo: dto.activo },
    });
    if (count === 0) throw new NotFoundException('Webhook no encontrado');
    return this.prisma.webhookEndpoint.findFirst({ where: { id, tenantId }, select: PUBLICO });
  }

  async eliminar(tenantId: string, id: string) {
    const { count } = await this.prisma.webhookEndpoint.deleteMany({ where: { id, tenantId } });
    if (count === 0) throw new NotFoundException('Webhook no encontrado');
    return { id };
  }

  async entregas(tenantId: string, id: string) {
    const existe = await this.prisma.webhookEndpoint.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!existe) throw new NotFoundException('Webhook no encontrado');
    return this.prisma.webhookDelivery.findMany({
      where: { endpointId: id, tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, evento: true, estado: true, intentos: true, ultimoStatus: true, error: true, createdAt: true, entregadoAt: true },
    });
  }

  async probar(tenantId: string, id: string) {
    const endpoint = await this.prisma.webhookEndpoint.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!endpoint) throw new NotFoundException('Webhook no encontrado');
    const entrega = await this.prisma.webhookDelivery.create({
      data: { tenantId, endpointId: id, evento: EVENTO_PRUEBA, payload: { mensaje: 'Entrega de prueba de SUTL' } },
      select: { id: true },
    });
    await this.despachar(tenantId, entrega.id);
    return this.prisma.webhookDelivery.findFirst({
      where: { id: entrega.id, tenantId },
      select: { id: true, evento: true, estado: true, intentos: true, createdAt: true },
    });
  }

  // Publica un evento a todos los webhooks activos de la empresa suscritos a él.
  // NUNCA lanza: un problema de webhooks no debe romper la operación de negocio
  // que lo originó (crear un envío, cambiar el estado de una OC…).
  async emitir(tenantId: string, evento: string, datos: Record<string, unknown>) {
    try {
      const endpoints = await this.prisma.webhookEndpoint.findMany({
        where: { tenantId, activo: true, eventos: { has: evento } },
        select: { id: true },
      });
      for (const e of endpoints) {
        const entrega = await this.prisma.webhookDelivery.create({
          data: { tenantId, endpointId: e.id, evento, payload: datos as object },
          select: { id: true },
        });
        await this.despachar(tenantId, entrega.id);
      }
    } catch (e) {
      this.logger.error(`No se pudo emitir ${evento}: ${(e as Error).message}`);
    }
  }

  private async despachar(tenantId: string, deliveryId: string) {
    if (this.cola) {
      await this.cola.add(TRABAJO_ENTREGAR, { tenantId, deliveryId });
      return;
    }
    // Sin Redis: un solo intento, sin bloquear la respuesta.
    void this.entregar(tenantId, deliveryId, true).catch((e) => this.logger.warn(`Entrega inline fallida: ${(e as Error).message}`));
  }

  // Lo llama el procesador de la cola. Si lanza, la cola reintenta con espera creciente.
  async entregar(tenantId: string, deliveryId: string, ultimoIntento: boolean) {
    const entrega = await this.prisma.webhookDelivery.findFirst({
      where: { id: deliveryId, tenantId },
      include: { endpoint: true },
    });
    if (!entrega || entrega.estado === 'entregado') return; // idempotente

    await this.prisma.webhookDelivery.updateMany({ where: { id: deliveryId, tenantId }, data: { intentos: { increment: 1 } } });
    const fallar = async (error: string, status: number | null, definitivo: boolean) => {
      await this.prisma.webhookDelivery.updateMany({
        where: { id: deliveryId, tenantId },
        data: { estado: definitivo || ultimoIntento ? 'fallido' : 'pendiente', error: error.slice(0, 300), ultimoStatus: status },
      });
      throw definitivo ? new ErrorDefinitivo(error) : new Error(error);
    };

    if (!entrega.endpoint.activo && entrega.evento !== EVENTO_PRUEBA) {
      return fallar('El webhook está desactivado.', null, true);
    }
    try {
      await validarUrlDestino(entrega.endpoint.url, permitirPrivadas());
    } catch (e) {
      // La URL dejó de ser segura (p. ej. el DNS ahora apunta a la red interna).
      return fallar((e as UrlDestinoInvalida).message, null, true);
    }

    const cuerpo = JSON.stringify({
      id: entrega.id,
      evento: entrega.evento,
      creadoAt: entrega.createdAt.toISOString(),
      datos: entrega.payload,
    });
    const timestamp = Math.floor(Date.now() / 1000);
    let status: number;
    try {
      const res = await fetch(entrega.endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SUTL-Webhooks/1',
          'X-SUTL-Event': entrega.evento,
          'X-SUTL-Delivery': entrega.id,
          'X-SUTL-Signature': firmarEntrega(descifrar(entrega.endpoint.secretCifrado), timestamp, cuerpo),
        },
        body: cuerpo,
        // Nunca seguir redirecciones: podrían llevar a una dirección interna.
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      status = res.status;
      await res.body?.cancel().catch(() => undefined); // la respuesta del receptor no se lee ni se guarda
    } catch (e) {
      return fallar(`No se pudo conectar: ${(e as Error).name === 'TimeoutError' ? 'tiempo de espera agotado' : 'error de red'}`, null, false);
    }

    if (status >= 200 && status < 300) {
      await this.prisma.webhookDelivery.updateMany({
        where: { id: deliveryId, tenantId },
        data: { estado: 'entregado', entregadoAt: new Date(), ultimoStatus: status, error: null },
      });
      return;
    }
    return fallar(`El destino respondió ${status}`, status, false);
  }

  private async validarUrl(url: string) {
    try {
      await validarUrlDestino(url, permitirPrivadas());
    } catch (e) {
      if (e instanceof UrlDestinoInvalida) throw new BadRequestException(e.message);
      throw e;
    }
  }
}
