import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';
import { COLA_NOTIFICACIONES } from '../queues/queues.constants';
import { ErrorDefinitivo } from './channels/channel';
import { MAX_INTENTOS, NotificationsService, TRABAJO_ENVIAR } from './notifications.service';

interface DatosEnvio {
  tenantId: string;
  notificationId: string;
}

@Processor(COLA_NOTIFICACIONES)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(private readonly notifications: NotificationsService) {
    super();
  }

  async process(job: Job<DatosEnvio>): Promise<void> {
    if (job.name !== TRABAJO_ENVIAR) throw new UnrecoverableError(`Trabajo desconocido: ${job.name}`);
    const { tenantId, notificationId } = job.data;
    if (!tenantId || !notificationId) throw new UnrecoverableError('El trabajo no indica empresa o notificación');
    const intentoActual = job.attemptsMade + 1;
    try {
      await this.notifications.enviar(tenantId, notificationId, intentoActual >= (job.opts.attempts ?? MAX_INTENTOS));
    } catch (e) {
      // Sin sentido reintentar un destino inválido o un rechazo definitivo.
      if (e instanceof ErrorDefinitivo) throw new UnrecoverableError(e.message);
      this.logger.warn(`Envío ${notificationId} falló (intento ${intentoActual}): ${(e as Error).message}`);
      throw e;
    }
  }
}
