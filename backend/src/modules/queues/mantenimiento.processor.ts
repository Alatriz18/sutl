import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { COLA_MANTENIMIENTO, TRABAJO_LATIDO } from './queues.constants';

// Procesa la cola de mantenimiento. Por ahora solo el "latido": demuestra que
// Redis, el programador y el worker están vivos. Las reglas de riesgo, las
// notificaciones y los webhooks se montan sobre esta misma base.
@Processor(COLA_MANTENIMIENTO)
export class MantenimientoProcessor extends WorkerHost {
  private readonly logger = new Logger(MantenimientoProcessor.name);

  async process(job: Job): Promise<{ ejecutadoEn: string }> {
    if (job.name === TRABAJO_LATIDO) {
      return { ejecutadoEn: new Date().toISOString() };
    }
    // Un trabajo desconocido es un error de programación: que falle y quede
    // registrado en vez de descartarse en silencio.
    this.logger.error(`Trabajo desconocido en ${COLA_MANTENIMIENTO}: ${job.name}`);
    throw new Error(`Trabajo desconocido: ${job.name}`);
  }
}
