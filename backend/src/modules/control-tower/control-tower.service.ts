import { Injectable } from '@nestjs/common';
import { EstadoOrdenCompra, EstadoTarea } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SupplyRiskService } from '../supply-risk/supply-risk.service';

const DIA_MS = 86_400_000;
const OC_VIGENTES: EstadoOrdenCompra[] = ['emitida', 'confirmada', 'despachada', 'recibida_parcial'];
const TAREA_ABIERTA: EstadoTarea[] = ['abierta', 'en_curso'];
// Cuántos elementos de cada lista se muestran en el tablero (el detalle está en cada pantalla).
const TOP = 5;
const MAX_TAREAS_HOY = 8;

// Tablero de la torre de control: junta en una sola llamada lo que requiere
// atención hoy. Solo lee; todo filtra por tenantId.
@Injectable()
export class ControlTowerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly risk: SupplyRiskService,
  ) {}

  // `hoy` se inyecta para poder probar con fechas fijas.
  async resumen(tenantId: string, userId: string, hoy = new Date(), diasVentana = 7) {
    const hasta = new Date(hoy.getTime() + diasVentana * DIA_MS);
    const finDelDia = new Date(hoy);
    finDelDia.setHours(23, 59, 59, 999);

    const [riesgo, ocsAtrasadas, ocsAtrasadasTotal, ocsPorVencer, ocsPorVencerTotal, embarquesPorLlegar, embarquesPorLlegarTotal, excepciones, tareasVencidas, tareasHoy] =
      await Promise.all([
        this.risk.evaluar(tenantId, hoy),
        this.prisma.purchaseOrder.findMany({
          where: { tenantId, estado: { in: OC_VIGENTES }, fechaRequerida: { lt: hoy } },
          select: { id: true, numero: true, fechaRequerida: true, proveedor: { select: { nombre: true } } },
          orderBy: { fechaRequerida: 'asc' },
          take: TOP,
        }),
        this.prisma.purchaseOrder.count({ where: { tenantId, estado: { in: OC_VIGENTES }, fechaRequerida: { lt: hoy } } }),
        this.prisma.purchaseOrder.findMany({
          where: { tenantId, estado: { in: OC_VIGENTES }, fechaRequerida: { gte: hoy, lte: hasta } },
          select: { id: true, numero: true, fechaRequerida: true, proveedor: { select: { nombre: true } } },
          orderBy: { fechaRequerida: 'asc' },
          take: TOP,
        }),
        this.prisma.purchaseOrder.count({ where: { tenantId, estado: { in: OC_VIGENTES }, fechaRequerida: { gte: hoy, lte: hasta } } }),
        this.prisma.shipment.findMany({
          where: { tenantId, estado: { not: 'entregado' }, fechaEstimadaLlegada: { gte: hoy, lte: hasta } },
          select: { id: true, codigoGuia: true, destino: true, estado: true, fechaEstimadaLlegada: true },
          orderBy: { fechaEstimadaLlegada: 'asc' },
          take: TOP,
        }),
        this.prisma.shipment.count({ where: { tenantId, estado: { not: 'entregado' }, fechaEstimadaLlegada: { gte: hoy, lte: hasta } } }),
        this.prisma.exceptionCase.groupBy({
          by: ['severidad'],
          where: { tenantId, estado: 'abierta' },
          _count: { _all: true },
        }),
        this.prisma.task.count({ where: { tenantId, estado: { in: TAREA_ABIERTA }, fechaLimite: { lt: hoy } } }),
        // Mis tareas abiertas que vencen hoy o ya vencieron.
        this.prisma.task.findMany({
          where: { tenantId, asignadoAId: userId, estado: { in: TAREA_ABIERTA }, fechaLimite: { lte: finDelDia } },
          select: { id: true, titulo: true, prioridad: true, fechaLimite: true, entidadTipo: true, entidadId: true },
          orderBy: { fechaLimite: 'asc' },
          take: MAX_TAREAS_HOY,
        }),
      ]);

    const cuentaSeveridad = (s: string) => excepciones.find((e) => e.severidad === s)?._count._all ?? 0;
    const criticas = cuentaSeveridad('critica');
    const altas = cuentaSeveridad('alta');
    const medias = cuentaSeveridad('media');

    return {
      generadoAt: hoy,
      ventanaDias: diasVentana,
      riesgo: {
        evaluadoAt: riesgo.evaluadoAt,
        resumen: riesgo.resumen,
        // Lo que más urgencia tiene: rojos primero y luego amarillos (la lista ya viene ordenada).
        criticos: riesgo.filas
          .filter((f) => f.semaforo === 'rojo' || f.semaforo === 'amarillo')
          .slice(0, TOP)
          .map((f) => ({ sku: f.sku, descripcion: f.descripcion, semaforo: f.semaforo, accion: f.accion, motivo: f.motivo, fechaQuiebre: f.fechaQuiebre, diasSinStock: f.diasSinStock })),
      },
      ocsAtrasadas: {
        total: ocsAtrasadasTotal,
        items: ocsAtrasadas.map((o) => ({
          id: o.id,
          numero: o.numero,
          proveedor: o.proveedor.nombre,
          fechaRequerida: o.fechaRequerida,
          diasAtraso: Math.floor((hoy.getTime() - (o.fechaRequerida as Date).getTime()) / DIA_MS),
        })),
      },
      vencimientos: {
        ocs: { total: ocsPorVencerTotal, items: ocsPorVencer.map((o) => ({ id: o.id, numero: o.numero, proveedor: o.proveedor.nombre, fechaRequerida: o.fechaRequerida })) },
        embarques: { total: embarquesPorLlegarTotal, items: embarquesPorLlegar },
      },
      excepciones: { abiertas: criticas + altas + medias, criticas, altas, medias },
      tareas: { vencidasEmpresa: tareasVencidas, misTareasHoy: tareasHoy },
    };
  }
}
