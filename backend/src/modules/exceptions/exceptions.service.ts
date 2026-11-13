import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap, Optional } from '@nestjs/common';
import { EstadoExcepcion, EstadoOrdenCompra, Prisma, SeveridadExcepcion } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { COLA_EXCEPCIONES } from '../queues/queues.constants';
import { SupplyRiskService } from '../supply-risk/supply-risk.service';
import { TenantConfigService } from '../tenant-config/tenant-config.service';

export const TRABAJO_EVALUAR_EXCEPCIONES = 'evaluar-excepciones';

const DIA_MS = 86_400_000;
const HORA_MS = 3_600_000;
// Una OC con más de estos días de atraso pasa de moderada a grave.
const DIAS_ATRASO_GRAVE = 7;
const OC_VIGENTES: EstadoOrdenCompra[] = ['emitida', 'confirmada', 'despachada', 'recibida_parcial'];
const MAX_OC = 500;

const cadaMinutos = () => {
  const n = Number(process.env.EXCEPCIONES_EVAL_CADA_MIN);
  return Number.isInteger(n) && n >= 5 ? n : 30;
};

interface Candidata {
  tipo: 'sku_en_rojo' | 'oc_atrasada';
  clave: string;
  severidad: SeveridadExcepcion;
  titulo: string;
  detalle: string;
}

export interface ResultadoExcepciones {
  abiertas: number;
  resueltas: number;
  escaladas: number;
}

// Convierte los problemas detectados (SKU en rojo, OC atrasada) en casos con
// plazo (SLA) y, si la empresa lo quiere, en una tarea. Si el plazo vence sin
// que el problema se resuelva, escala: sube la severidad y avisa al administrador.
@Injectable()
export class ExceptionsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ExceptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly risk: SupplyRiskService,
    private readonly tenantConfig: TenantConfigService,
    private readonly audit: AuditService,
    @Optional() private readonly notifications?: NotificationsService,
    @Optional() @InjectQueue(COLA_EXCEPCIONES) private readonly cola?: Queue,
  ) {}

  async onApplicationBootstrap() {
    if (!this.cola || process.env.NODE_ENV === 'test') return;
    try {
      await this.cola.upsertJobScheduler(
        TRABAJO_EVALUAR_EXCEPCIONES,
        { every: cadaMinutos() * 60_000 },
        { name: TRABAJO_EVALUAR_EXCEPCIONES, data: {} },
      );
    } catch (e) {
      this.logger.error('No se pudo programar la evaluación de excepciones', e as Error);
    }
  }

  list(tenantId: string, estado?: EstadoExcepcion) {
    return this.prisma.exceptionCase.findMany({
      where: { tenantId, ...(estado ? { estado } : {}) },
      orderBy: [{ estado: 'asc' }, { venceSlaAt: 'asc' }],
      take: 300,
    });
  }

  async evaluarTodas() {
    const empresas = await this.prisma.tenant.findMany({ where: { activo: true }, select: { id: true } });
    const total: ResultadoExcepciones = { abiertas: 0, resueltas: 0, escaladas: 0 };
    for (const e of empresas) {
      try {
        const r = await this.evaluarEmpresa(e.id);
        total.abiertas += r.abiertas;
        total.resueltas += r.resueltas;
        total.escaladas += r.escaladas;
      } catch (err) {
        this.logger.error(`Falló la evaluación de excepciones de la empresa ${e.id}: ${(err as Error).message}`);
      }
    }
    return { empresas: empresas.length, ...total };
  }

  // `hoy` se inyecta para poder probar con fechas fijas.
  async evaluarEmpresa(tenantId: string, hoy = new Date()): Promise<ResultadoExcepciones> {
    const config = (await this.tenantConfig.getEfectiva(tenantId)).excepciones;
    const slaMs = { alta: config.slaAltaHoras * HORA_MS, media: config.slaMediaHoras * HORA_MS };

    const candidatas = await this.detectar(tenantId, hoy);
    const claves = new Map(candidatas.map((c) => [`${c.tipo}:${c.clave}`, c]));
    const existentes = await this.prisma.exceptionCase.findMany({ where: { tenantId } });
    const porClave = new Map(existentes.map((e) => [`${e.tipo}:${e.clave}`, e]));
    const resultado: ResultadoExcepciones = { abiertas: 0, resueltas: 0, escaladas: 0 };

    // 1) Lo que ya no es un problema se resuelve solo (condicional: no pisa una resolución concurrente).
    for (const e of existentes.filter((x) => x.estado === 'abierta' && !claves.has(`${x.tipo}:${x.clave}`))) {
      const { count } = await this.prisma.exceptionCase.updateMany({
        where: { id: e.id, tenantId, estado: 'abierta' },
        data: { estado: 'resuelta', resueltaAt: hoy },
      });
      if (count === 0) continue;
      resultado.resueltas++;
      await this.audit.registrar({ tenantId, accion: 'excepcion.resuelta', entidad: 'excepcion', entidadId: e.id, metadata: { tipo: e.tipo, clave: e.clave } });
    }

    // 2) Lo nuevo (o lo que reapareció) se abre con su plazo.
    for (const c of candidatas) {
      const previo = porClave.get(`${c.tipo}:${c.clave}`);
      if (previo?.estado === 'abierta') continue;
      const venceSlaAt = new Date(hoy.getTime() + (c.severidad === 'media' ? slaMs.media : slaMs.alta));
      let id: string;
      if (previo) {
        const { count } = await this.prisma.exceptionCase.updateMany({
          where: { id: previo.id, tenantId, estado: 'resuelta' },
          data: { estado: 'abierta', severidad: c.severidad, titulo: c.titulo, detalle: c.detalle, venceSlaAt, escaladaAt: null, resueltaAt: null, taskId: null },
        });
        if (count === 0) continue;
        id = previo.id;
      } else {
        try {
          id = (await this.prisma.exceptionCase.create({ data: { tenantId, ...c, venceSlaAt } })).id;
        } catch (e) {
          if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue; // otra evaluación ganó
          throw e;
        }
      }
      resultado.abiertas++;
      const taskId = config.crearTareas ? await this.abrirTarea(tenantId, id, c, venceSlaAt) : null;
      if (taskId) await this.prisma.exceptionCase.update({ where: { id }, data: { taskId } });
      await this.audit.registrar({
        tenantId,
        accion: 'excepcion.abierta',
        entidad: 'excepcion',
        entidadId: id,
        metadata: { tipo: c.tipo, clave: c.clave, severidad: c.severidad, taskId },
      });
    }

    // 3) Plazo vencido y sigue abierta: escala una sola vez y avisa en un solo correo.
    const vencidas = await this.prisma.exceptionCase.findMany({
      where: { tenantId, estado: 'abierta', escaladaAt: null, venceSlaAt: { lt: hoy } },
    });
    const escaladas: typeof vencidas = [];
    for (const e of vencidas) {
      const { count } = await this.prisma.exceptionCase.updateMany({
        where: { id: e.id, tenantId, estado: 'abierta', escaladaAt: null },
        data: { escaladaAt: hoy, severidad: 'critica' },
      });
      if (count === 0) continue;
      escaladas.push(e);
      await this.audit.registrar({ tenantId, accion: 'excepcion.escalada', entidad: 'excepcion', entidadId: e.id, metadata: { tipo: e.tipo, clave: e.clave, vencio: e.venceSlaAt } });
    }
    resultado.escaladas = escaladas.length;
    await this.avisarEscaladas(tenantId, escaladas);
    return resultado;
  }

  // Qué está mal ahora mismo: SKU en rojo y OC con fecha requerida vencida.
  private async detectar(tenantId: string, hoy: Date): Promise<Candidata[]> {
    const out: Candidata[] = [];

    const riesgo = await this.risk.evaluar(tenantId, hoy);
    for (const f of riesgo.filas.filter((x) => x.semaforo === 'rojo')) {
      out.push({ tipo: 'sku_en_rojo', clave: f.sku, severidad: 'alta', titulo: `SKU ${f.sku} en rojo`, detalle: f.motivo });
    }

    const ocs = await this.prisma.purchaseOrder.findMany({
      where: { tenantId, estado: { in: OC_VIGENTES }, fechaRequerida: { lt: hoy } },
      select: { id: true, numero: true, fechaRequerida: true, proveedor: { select: { nombre: true } } },
      orderBy: { fechaRequerida: 'asc' },
      take: MAX_OC,
    });
    for (const oc of ocs) {
      const dias = Math.floor((hoy.getTime() - (oc.fechaRequerida as Date).getTime()) / DIA_MS);
      out.push({
        tipo: 'oc_atrasada',
        clave: oc.id,
        severidad: dias > DIAS_ATRASO_GRAVE ? 'alta' : 'media',
        titulo: `OC ${oc.numero} atrasada`,
        detalle: `La OC ${oc.numero} de ${oc.proveedor.nombre} debía llegar hace ${dias} día${dias === 1 ? '' : 's'} y sigue sin recibirse completa.`,
      });
    }
    return out;
  }

  // La tarea la "crea" el primer administrador activo (el sistema no es un usuario).
  private async abrirTarea(tenantId: string, casoId: string, c: Candidata, venceSlaAt: Date): Promise<string | null> {
    const admin = await this.prisma.user.findFirst({ where: { tenantId, rol: 'admin_tenant', activo: true }, orderBy: { createdAt: 'asc' }, select: { id: true } });
    if (!admin) return null;
    const tarea = await this.prisma.task.create({
      data: {
        tenantId,
        creadoPorId: admin.id,
        titulo: c.titulo,
        descripcion: c.detalle,
        prioridad: c.severidad === 'media' ? 'media' : 'alta',
        fechaLimite: venceSlaAt,
        entidadTipo: c.tipo === 'sku_en_rojo' ? 'sku' : 'orden_compra',
        entidadId: c.clave,
      },
      select: { id: true },
    });
    await this.audit.registrar({ tenantId, accion: 'tarea.creada', entidad: 'tarea', entidadId: tarea.id, metadata: { titulo: c.titulo, origen: 'excepcion', excepcionId: casoId } });
    return tarea.id;
  }

  private async avisarEscaladas(tenantId: string, escaladas: { titulo: string; detalle: string }[]) {
    if (escaladas.length === 0 || !this.notifications) return;
    try {
      const admins = await this.prisma.user.findMany({ where: { tenantId, rol: 'admin_tenant', activo: true }, select: { id: true, email: true } });
      const asunto = escaladas.length === 1 ? `SUTL: plazo vencido — ${escaladas[0].titulo}` : `SUTL: ${escaladas.length} excepciones con el plazo vencido`;
      const lineas = escaladas.slice(0, 30).map((e) => `• ${e.titulo}: ${e.detalle}`);
      const resto = escaladas.length > 30 ? `\n…y ${escaladas.length - 30} más. Míralas en Excepciones.` : '';
      const mensaje = `Estas excepciones siguen abiertas y su plazo de atención venció:\n\n${lineas.join('\n')}${resto}`;
      for (const a of admins) {
        try {
          await this.notifications.create(tenantId, { canal: 'email', tipo: 'excepcion_escalada', asunto, mensaje, destino: a.email, userId: a.id });
        } catch (e) {
          this.logger.warn(`No se pudo avisar la escalada a un administrador de la empresa ${tenantId}: ${(e as Error).message}`);
        }
      }
    } catch (e) {
      this.logger.error(`Falló el aviso de escalada de la empresa ${tenantId}: ${(e as Error).message}`);
    }
  }
}
