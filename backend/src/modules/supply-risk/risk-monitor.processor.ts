import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';
import { COLA_RIESGO } from '../queues/queues.constants';
import { RiskMonitorService, TRABAJO_EVALUAR_TODAS } from './risk-monitor.service';

@Processor(COLA_RIESGO)
export class RiskMonitorProcessor extends WorkerHost {
  private readonly logger = new Logger(RiskMonitorProcessor.name);

  constructor(private readonly monitor: RiskMonitorService) {
    super();
  }

  async process(job: Job): Promise<{ empresas: number; cambios: number }> {
    if (job.name !== TRABAJO_EVALUAR_TODAS) throw new UnrecoverableError(`Trabajo desconocido: ${job.name}`);
    const r = await this.monitor.evaluarTodas();
    this.logger.log(`Riesgo evaluado: ${r.empresas} empresa(s), ${r.cambios} cambio(s) de semáforo`);
    return r;
  }
}
