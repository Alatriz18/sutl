import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap, Optional } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { COLA_DOCUMENTOS } from '../queues/queues.constants';
import { TenantConfigService } from '../tenant-config/tenant-config.service';
import { ETIQUETA_TIPO } from './checklist';
import { DocumentsService } from './documents.service';

export const TRABAJO_AVISAR_VENCIMIENTOS = 'avisar-vencimientos';

const MAX_LINEAS = 30;
const fechaCorta = (d: Date) => d.toISOString().slice(0, 10);

// Cada cuántos minutos se revisan los vencimientos de todas las empresas (6 horas por defecto).
const cadaMinutos = () => {
  const n = Number(process.env.DOC_AVISOS_CADA_MIN);
  return Number.isInteger(n) && n >= 5 ? n : 360;
};

export interface ResultadoAvisos {
  porVencer: number;
  vencidos: number;
  correos: number;
}

// Avisa por correo a los administradores de cada empresa de los documentos que están por vencer o ya vencieron.
// Cada documento se avisa UNA sola vez por estado: el aviso se «reclama» con un UPDATE condicional (atómico), así dos
// rondas simultáneas no duplican el correo; si no se pudo enviar a nadie, el reclamo se libera y se reintenta después.
@Injectable()
export class DocumentExpiryMonitorService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DocumentExpiryMonitorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
    private readonly tenantConfig: TenantConfigService,
    @Optional() private readonly notifications?: NotificationsService,
    @Optional() @InjectQueue(COLA_DOCUMENTOS) private readonly cola?: Queue,
  ) {}

  async onApplicationBootstrap() {
    if (!this.cola || process.env.NODE_ENV === 'test') return;
    try {
      await this.cola.upsertJobScheduler(TRABAJO_AVISAR_VENCIMIENTOS, { every: cadaMinutos() * 60_000 }, { name: TRABAJO_AVISAR_VENCIMIENTOS, data: {} });
    } catch (e) {
      this.logger.error('No se pudo programar el aviso de vencimientos', e as Error);
    }
  }

  // Ronda programada: todas las empresas activas. Una empresa que falla no frena a las demás.
  async avisarTodas(hoy = new Date()) {
    const empresas = await this.prisma.tenant.findMany({ where: { activo: true, documentos: { some: { fechaVencimiento: { not: null } } } }, select: { id: true } });
    const total: ResultadoAvisos = { porVencer: 0, vencidos: 0, correos: 0 };
    for (const e of empresas) {
      try {
        const r = await this.avisarEmpresa(e.id, hoy);
        total.porVencer += r.porVencer;
        total.vencidos += r.vencidos;
        total.correos += r.correos;
      } catch (err) {
        this.logger.error(`Falló el aviso de vencimientos de la empresa ${e.id}: ${(err as Error).message}`);
      }
    }
    return { empresas: empresas.length, ...total };
  }

  async avisarEmpresa(tenantId: string, hoy = new Date()): Promise<ResultadoAvisos> {
    const vacio: ResultadoAvisos = { porVencer: 0, vencidos: 0, correos: 0 };
    if (!this.notifications) return vacio;
    const cfg = (await this.tenantConfig.getEfectiva(tenantId)).documentos;
    if (!cfg.avisarVencimientos) return vacio;

    const items = await this.documents.proximosVencimientos(tenantId, hoy);
    // Solo lo que de verdad vence pronto o ya venció (los «pendientes» sin fecha cercana no son de este aviso).
    const relevantes = items.filter((i) => i.estado === 'vencido' || i.estado === 'por_vencer' || (i.diasParaVencer !== null && i.diasParaVencer <= cfg.diasAvisoVencimiento));

    const reclamados: { id: string; campo: 'avisoPorVencerAt' | 'avisoVencidoAt'; item: (typeof items)[number] }[] = [];
    for (const item of relevantes) {
      const campo = item.estado === 'vencido' || item.fechaVencimiento.getTime() < hoy.getTime() ? 'avisoVencidoAt' : 'avisoPorVencerAt';
      const { count } = await this.prisma.document.updateMany({ where: { id: item.id, tenantId, [campo]: null }, data: { [campo]: hoy } });
      if (count === 1) reclamados.push({ id: item.id, campo, item });
    }
    if (reclamados.length === 0) return vacio;

    const enviados = await this.enviar(tenantId, reclamados.map((r) => ({ ...r.item, vencido: r.campo === 'avisoVencidoAt' })));
    if (enviados === 0) {
      // Nadie recibió el aviso (sin administradores o el correo falló): se libera para reintentar en la próxima ronda.
      for (const r of reclamados) await this.prisma.document.updateMany({ where: { id: r.id, tenantId }, data: { [r.campo]: null } });
      return vacio;
    }
    return {
      porVencer: reclamados.filter((r) => r.campo === 'avisoPorVencerAt').length,
      vencidos: reclamados.filter((r) => r.campo === 'avisoVencidoAt').length,
      correos: enviados,
    };
  }

  // Un solo correo por administrador con todo lo que hay que atender (no uno por documento).
  private async enviar(tenantId: string, items: { codigoGuia: string; tipo: keyof typeof ETIQUETA_TIPO; fechaVencimiento: Date; vencido: boolean }[]): Promise<number> {
    const admins = await this.prisma.user.findMany({ where: { tenantId, rol: 'admin_tenant', activo: true }, select: { id: true, email: true } });
    if (admins.length === 0 || !this.notifications) return 0;
    const vencidos = items.filter((i) => i.vencido);
    const porVencer = items.filter((i) => !i.vencido);
    const linea = (i: (typeof items)[number]) => `• ${ETIQUETA_TIPO[i.tipo]} del envío ${i.codigoGuia}: ${i.vencido ? 'venció' : 'vence'} el ${fechaCorta(i.fechaVencimiento)}`;
    const bloque = (titulo: string, lista: typeof items) => (lista.length ? `${titulo}\n${lista.slice(0, MAX_LINEAS).map(linea).join('\n')}${lista.length > MAX_LINEAS ? `\n…y ${lista.length - MAX_LINEAS} más.` : ''}` : '');
    const mensaje = [bloque('Documentos VENCIDOS:', vencidos), bloque('Documentos por vencer:', porVencer)].filter(Boolean).join('\n\n') + '\n\nEntra a SUTL, abre el envío y sube la versión vigente del documento.';
    const asunto = vencidos.length ? `SUTL: ${vencidos.length} documento(s) vencido(s)${porVencer.length ? ` y ${porVencer.length} por vencer` : ''}` : `SUTL: ${porVencer.length} documento(s) por vencer`;

    let enviados = 0;
    for (const a of admins) {
      try {
        await this.notifications.create(tenantId, { canal: 'email', tipo: 'documento_vencimiento', asunto, mensaje, destino: a.email, userId: a.id });
        enviados++;
      } catch (e) {
        this.logger.warn(`No se pudo avisar del vencimiento de documentos a un administrador de la empresa ${tenantId}: ${(e as Error).message}`);
      }
    }
    return enviados;
  }
}
