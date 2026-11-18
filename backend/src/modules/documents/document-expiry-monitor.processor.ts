import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';
import { COLA_DOCUMENTOS } from '../queues/queues.constants';
import { DocumentExpiryMonitorService, TRABAJO_AVISAR_VENCIMIENTOS } from './document-expiry-monitor.service';

@Processor(COLA_DOCUMENTOS)
export class DocumentExpiryMonitorProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentExpiryMonitorProcessor.name);

  constructor(private readonly monitor: DocumentExpiryMonitorService) {
    super();
  }

  async process(job: Job) {
    if (job.name !== TRABAJO_AVISAR_VENCIMIENTOS) throw new UnrecoverableError(`Trabajo desconocido: ${job.name}`);
    const r = await this.monitor.avisarTodas();
    this.logger.log(`Vencimientos de documentos: ${r.empresas} empresa(s), ${r.vencidos} vencido(s) y ${r.porVencer} por vencer avisados`);
    return r;
  }
}
