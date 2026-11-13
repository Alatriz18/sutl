import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';
import { COLA_EXCEPCIONES } from '../queues/queues.constants';
import { ExceptionsService, TRABAJO_EVALUAR_EXCEPCIONES } from './exceptions.service';

@Processor(COLA_EXCEPCIONES)
export class ExceptionsProcessor extends WorkerHost {
  private readonly logger = new Logger(ExceptionsProcessor.name);

  constructor(private readonly exceptions: ExceptionsService) {
    super();
  }

  async process(job: Job) {
    if (job.name !== TRABAJO_EVALUAR_EXCEPCIONES) throw new UnrecoverableError(`Trabajo desconocido: ${job.name}`);
    const r = await this.exceptions.evaluarTodas();
    this.logger.log(`Excepciones: ${r.empresas} empresa(s), ${r.abiertas} abiertas, ${r.resueltas} resueltas, ${r.escaladas} escaladas`);
    return r;
  }
}
