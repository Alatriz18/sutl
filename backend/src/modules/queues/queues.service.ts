import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap, Optional } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  COLA_MANTENIMIENTO,
  LATIDO_CADA_MS,
  TRABAJO_LATIDO,
} from './queues.constants';

export interface DatosTrabajo {
  // Aislamiento multi-tenant: todo trabajo de negocio declara su empresa y el
  // procesador debe filtrar por ella. Solo el latido (sin datos de negocio) es global.
  tenantId: string;
  [clave: string]: unknown;
}

@Injectable()
export class QueuesService implements OnApplicationBootstrap {
  private readonly logger = new Logger(QueuesService.name);

  constructor(
    @Optional() @InjectQueue(COLA_MANTENIMIENTO) private readonly mantenimiento?: Queue,
  ) {}

  get habilitado() {
    return !!this.mantenimiento;
  }

  async onApplicationBootstrap() {
    if (!this.mantenimiento || process.env.NODE_ENV === 'test') return;
    try {
      // upsert: idempotente, no duplica el programador en cada arranque.
      await this.mantenimiento.upsertJobScheduler(
        TRABAJO_LATIDO,
        { every: LATIDO_CADA_MS },
        { name: TRABAJO_LATIDO, data: {} },
      );
    } catch (e) {
      this.logger.error('No se pudo programar el latido', e as Error);
    }
  }

  // Encola un trabajo de negocio. Exige tenantId para que nadie olvide el aislamiento.
  async encolar(nombre: string, datos: DatosTrabajo) {
    if (!this.mantenimiento) throw new Error('Las colas están deshabilitadas (falta REDIS_URL)');
    if (!datos.tenantId) throw new Error('Todo trabajo debe indicar tenantId');
    return this.mantenimiento.add(nombre, datos);
  }

  async estado() {
    if (!this.mantenimiento) return { habilitado: false };
    const [conteos, programadores, ultimo] = await Promise.all([
      this.mantenimiento.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
      this.mantenimiento.getJobSchedulers(),
      this.mantenimiento.getJobs(['completed'], 0, 0, false),
    ]);
    return {
      habilitado: true,
      cola: COLA_MANTENIMIENTO,
      conteos,
      programadores: programadores.map((p) => ({ clave: p.key, cadaMs: p.every ?? null })),
      ultimoLatido: ultimo[0]?.returnvalue?.ejecutadoEn ?? null,
    };
  }
}
