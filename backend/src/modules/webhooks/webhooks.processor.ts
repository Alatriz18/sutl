import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';
import { ErrorDefinitivo } from '../notifications/channels/channel';
import { COLA_WEBHOOKS } from '../queues/queues.constants';
import { MAX_INTENTOS_WEBHOOK, TRABAJO_ENTREGAR, WebhooksService } from './webhooks.service';

interface DatosEntrega {
  tenantId: string;
  deliveryId: string;
}

@Processor(COLA_WEBHOOKS)
export class WebhooksProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhooksProcessor.name);

  constructor(private readonly webhooks: WebhooksService) {
    super();
  }

  async process(job: Job<DatosEntrega>): Promise<void> {
    if (job.name !== TRABAJO_ENTREGAR) throw new UnrecoverableError(`Trabajo desconocido: ${job.name}`);
    const { tenantId, deliveryId } = job.data;
    if (!tenantId || !deliveryId) throw new UnrecoverableError('El trabajo no indica empresa o entrega');
    const intento = job.attemptsMade + 1;
    try {
      await this.webhooks.entregar(tenantId, deliveryId, intento >= (job.opts.attempts ?? MAX_INTENTOS_WEBHOOK));
    } catch (e) {
      this.logger.warn(`Entrega ${deliveryId} falló (intento ${intento}): ${(e as Error).message}`);
      // Un webhook desactivado o con URL insegura no mejora reintentando.
      if (e instanceof ErrorDefinitivo) throw new UnrecoverableError(e.message);
      throw e;
    }
  }
}
