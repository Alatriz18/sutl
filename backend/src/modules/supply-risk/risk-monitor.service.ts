import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { COLA_RIESGO } from '../queues/queues.constants';
import { TenantConfigService } from '../tenant-config/tenant-config.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { AccionRecomendada } from './risk-engine';
import { SupplyRiskService } from './supply-risk.service';

export const TRABAJO_EVALUAR_TODAS = 'evaluar-todas';

const ETIQUETA_ACCION: Record<AccionRecomendada, string> = {
  adelantar_proveedor: 'urgir al proveedor que despache ya',
  partir_envio: 'partir el embarque y adelantar una parte',
  compra_urgente: 'comprar ya',
  confirmar_fecha: 'confirmar la fecha real de llegada',
  planificar_compra: 'planificar la compra',
  ninguna: '',
};

// Cada cuántos minutos se evalúa el riesgo de todas las empresas.
const cadaMinutos = () => {
  const n = Number(process.env.RISK_EVAL_CADA_MIN);
  return Number.isInteger(n) && n >= 5 ? n : 60;
};

export interface CambioDeSemaforo {
  sku: string;
  desde: string | null;
  hacia: string;
  accion: string;
  motivo: string;
  fechaQuiebre: Date | null;
}

// Evalúa el riesgo cada cierto tiempo, recuerda el último semáforo de cada SKU
// y, cuando cambia, deja historial, avisa a los webhooks y —si la empresa lo
// pidió— escribe a sus administradores cuando un SKU pasa a rojo.
@Injectable()
export class RiskMonitorService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RiskMonitorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly risk: SupplyRiskService,
    private readonly tenantConfig: TenantConfigService,
    @Optional() private readonly notifications?: NotificationsService,
    @Optional() private readonly webhooks?: WebhooksService,
    @Optional() @InjectQueue(COLA_RIESGO) private readonly cola?: Queue,
  ) {}

  async onApplicationBootstrap() {
    if (!this.cola || process.env.NODE_ENV === 'test') return;
    try {
      // upsert: idempotente, no duplica el programador en cada arranque.
      await this.cola.upsertJobScheduler(
        TRABAJO_EVALUAR_TODAS,
        { every: cadaMinutos() * 60_000 },
        { name: TRABAJO_EVALUAR_TODAS, data: {} },
      );
    } catch (e) {
      this.logger.error('No se pudo programar la evaluación de riesgo', e as Error);
    }
  }

  // Ronda programada: todas las empresas activas que tienen SKUs con política.
  // Una empresa que falla no frena a las demás.
  async evaluarTodas() {
    const empresas = await this.prisma.tenant.findMany({
      where: { activo: true, inventoryPolicies: { some: {} } },
      select: { id: true },
    });
    let cambios = 0;
    for (const e of empresas) {
      try {
        cambios += (await this.evaluarEmpresa(e.id)).length;
      } catch (err) {
        this.logger.error(`Falló la evaluación de riesgo de la empresa ${e.id}: ${(err as Error).message}`);
      }
    }
    return { empresas: empresas.length, cambios };
  }

  // Evalúa una empresa, registra los cambios de semáforo y avisa. Devuelve los cambios.
  async evaluarEmpresa(tenantId: string, hoy = new Date()): Promise<CambioDeSemaforo[]> {
    const resultado = await this.risk.evaluar(tenantId, hoy);
    const previos = new Map((await this.prisma.riskState.findMany({ where: { tenantId } })).map((s) => [s.sku, s]));
    const cambios: CambioDeSemaforo[] = [];

    for (const fila of resultado.filas) {
      const previo = previos.get(fila.sku);
      const registro = {
        sku: fila.sku,
        desde: previo?.semaforo ?? null,
        hacia: fila.semaforo,
        accion: fila.accion,
        motivo: fila.motivo,
        fechaQuiebre: fila.fechaQuiebre,
      };
      if (!previo) {
        // Primera vez que se ve este SKU. Si dos evaluaciones coinciden, gana una (unique).
        try {
          await this.prisma.riskState.create({
            data: { tenantId, sku: fila.sku, semaforo: fila.semaforo, accion: fila.accion, evaluadoAt: hoy },
          });
        } catch (e) {
          if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
          throw e;
        }
      } else if (previo.semaforo !== fila.semaforo) {
        // Condicional en el semáforo anterior: si otra evaluación ya registró este
        // cambio, no se duplica (ni el historial ni el aviso).
        const { count } = await this.prisma.riskState.updateMany({
          where: { tenantId, sku: fila.sku, semaforo: previo.semaforo },
          data: { semaforo: fila.semaforo, accion: fila.accion, evaluadoAt: hoy },
        });
        if (count === 0) continue;
      } else {
        continue; // sin cambio de semáforo
      }
      await this.prisma.riskChange.create({ data: { tenantId, ...registro } });
      cambios.push(registro);
    }

    if (cambios.length > 0) {
      for (const c of cambios) {
        void this.webhooks?.emitir(tenantId, 'riesgo.semaforo_cambiado', {
          sku: c.sku,
          desde: c.desde,
          hacia: c.hacia,
          accion: c.accion,
          motivo: c.motivo,
          fechaQuiebre: c.fechaQuiebre?.toISOString() ?? null,
        });
      }
      await this.avisarRojos(tenantId, cambios.filter((c) => c.hacia === 'rojo'));
    }
    return cambios;
  }

  cambios(tenantId: string) {
    return this.prisma.riskChange.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, sku: true, desde: true, hacia: true, accion: true, motivo: true, fechaQuiebre: true, avisado: true, createdAt: true },
    });
  }

  // Un solo correo por ronda con todos los SKU que pasaron a rojo (no uno por SKU).
  private async avisarRojos(tenantId: string, rojos: CambioDeSemaforo[]) {
    if (rojos.length === 0 || !this.notifications) return;
    try {
      const config = await this.tenantConfig.getEfectiva(tenantId);
      if (!config.riesgo.avisarAlPasarARojo) return;
      const admins = await this.prisma.user.findMany({
        where: { tenantId, rol: 'admin_tenant', activo: true },
        select: { id: true, email: true },
      });
      if (admins.length === 0) return;

      const asunto = rojos.length === 1 ? `SUTL: ${rojos[0].sku} está en rojo` : `SUTL: ${rojos.length} SKU pasaron a rojo`;
      const lineas = rojos
        .slice(0, 30)
        .map((c) => `• ${c.sku}: ${c.motivo}${ETIQUETA_ACCION[c.accion as AccionRecomendada] ? ` Qué hacer: ${ETIQUETA_ACCION[c.accion as AccionRecomendada]}.` : ''}`);
      const resto = rojos.length > 30 ? `\n…y ${rojos.length - 30} más. Mira el detalle en Riesgo de abastecimiento.` : '';
      const mensaje = `Estos SKU pasaron a rojo (se quedarían sin stock antes de que llegue la reposición):\n\n${lineas.join('\n')}${resto}`;

      let enviado = false;
      for (const a of admins) {
        try {
          await this.notifications.create(tenantId, { canal: 'email', tipo: 'riesgo_rojo', asunto, mensaje, destino: a.email, userId: a.id });
          enviado = true;
        } catch (e) {
          this.logger.warn(`No se pudo avisar a un administrador de la empresa ${tenantId}: ${(e as Error).message}`);
        }
      }
      if (enviado) {
        await this.prisma.riskChange.updateMany({
          where: { tenantId, hacia: 'rojo', avisado: false, sku: { in: rojos.map((r) => r.sku) } },
          data: { avisado: true },
        });
      }
    } catch (e) {
      this.logger.error(`Falló el aviso de riesgo de la empresa ${tenantId}: ${(e as Error).message}`);
    }
  }
}
