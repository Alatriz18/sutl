import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PrismaService } from '../../prisma/prisma.service';
import { TrackingEvent, TrackingEventDocument } from '../tracking-events/schemas/tracking-event.schema';
import { ESTADOS_ABIERTOS, OcAnalitica, aging, puntualidadEnvios, resumenAnalitica, tendenciaMensual } from './analytics-engine';

const DIA_MS = 86_400_000;
const POR_DEFECTO_DIAS = 90;
const MAX_DIAS = 366;
// Tope defensivo de filas por consulta: un tablero no necesita más y protege a la base.
const MAX_OC = 5000;

const ESTADOS_EVALUABLES = ['emitida', 'confirmada', 'despachada', 'recibida_parcial', 'recibida'] as const;

const SELECT_OC = {
  id: true,
  numero: true,
  proveedorId: true,
  estado: true,
  fechaEmision: true,
  fechaRequerida: true,
  fechaConfirmadaProveedor: true,
  fechaDespacho: true,
  proveedor: { select: { nombre: true } },
  lineas: { select: { cantidad: true, cantidadRecibida: true, recepciones: { select: { fecha: true } } } },
} as const;

type FilaOc = {
  id: string;
  numero: string;
  proveedorId: string;
  estado: string;
  fechaEmision: Date;
  fechaRequerida: Date | null;
  fechaConfirmadaProveedor: Date | null;
  fechaDespacho: Date | null;
  proveedor: { nombre: string };
  lineas: { cantidad: number; cantidadRecibida: number; recepciones: { fecha: Date }[] }[];
};

const aOc = (f: FilaOc): OcAnalitica => ({
  id: f.id,
  numero: f.numero,
  proveedorId: f.proveedorId,
  proveedorNombre: f.proveedor.nombre,
  estado: f.estado,
  fechaEmision: f.fechaEmision,
  fechaRequerida: f.fechaRequerida,
  fechaConfirmadaProveedor: f.fechaConfirmadaProveedor,
  fechaDespacho: f.fechaDespacho,
  lineas: f.lineas,
});

// Analítica de abastecimiento de una empresa: toda consulta filtra por tenantId.
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectModel(TrackingEvent.name) private readonly eventos: Model<TrackingEventDocument>,
  ) {}

  // `hoy` se inyecta para poder probar con fechas fijas.
  async resumen(tenantId: string, q: { desde?: string; hasta?: string }, hoy = new Date()) {
    const hasta = q.hasta ? new Date(q.hasta) : hoy;
    const desde = q.desde ? new Date(q.desde) : new Date(hasta.getTime() - POR_DEFECTO_DIAS * DIA_MS);
    if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime())) throw new BadRequestException('Las fechas no son válidas');
    if (desde.getTime() > hasta.getTime()) throw new BadRequestException('La fecha inicial no puede ser posterior a la final');
    if (hasta.getTime() - desde.getTime() > MAX_DIAS * DIA_MS) throw new BadRequestException(`El periodo no puede pasar de ${MAX_DIAS} días`);

    const inicioTendencia = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 5, 1));
    const [delPeriodo, abiertas, paraTendencia, entregados] = await Promise.all([
      // OC que vencían (fecha requerida) dentro del periodo.
      this.prisma.purchaseOrder.findMany({
        where: { tenantId, estado: { in: [...ESTADOS_EVALUABLES] }, fechaRequerida: { gte: desde, lte: hasta } },
        select: SELECT_OC,
        take: MAX_OC,
      }),
      this.prisma.purchaseOrder.findMany({ where: { tenantId, estado: { in: [...ESTADOS_ABIERTOS] } }, select: SELECT_OC, take: MAX_OC }),
      this.prisma.purchaseOrder.findMany({
        where: { tenantId, estado: { in: [...ESTADOS_EVALUABLES] }, fechaRequerida: { gte: inicioTendencia } },
        select: SELECT_OC,
        take: MAX_OC,
      }),
      this.prisma.shipment.findMany({
        where: { tenantId, estado: 'entregado', fechaEstimadaLlegada: { gte: desde, lte: hasta } },
        select: { id: true, fechaEstimadaLlegada: true },
        take: MAX_OC,
      }),
    ]);

    return {
      periodo: { desde, hasta },
      generadoAt: hoy,
      ...resumenAnalitica((delPeriodo as FilaOc[]).map(aOc), hoy),
      aging: aging((abiertas as FilaOc[]).map(aOc), hoy),
      tendencia: tendenciaMensual((paraTendencia as FilaOc[]).map(aOc), hoy),
      envios: await this.puntualidad(tenantId, entregados),
    };
  }

  // El momento real de la entrega es el primer evento «entregado» del seguimiento (Mongo).
  private async puntualidad(tenantId: string, envios: { id: string; fechaEstimadaLlegada: Date | null }[]) {
    if (envios.length === 0) return puntualidadEnvios([]);
    const docs = await this.eventos
      .find({ tenantId, estado: 'entregado', shipmentId: { $in: envios.map((e) => e.id) } })
      .select({ shipmentId: 1, timestamp: 1 })
      .lean();
    const primero = new Map<string, Date>();
    for (const d of docs as unknown as { shipmentId: string; timestamp: Date }[]) {
      const actual = primero.get(d.shipmentId);
      if (!actual || d.timestamp < actual) primero.set(d.shipmentId, d.timestamp);
    }
    const items = envios.flatMap((e) => {
      const entregadoAt = primero.get(e.id);
      return entregadoAt && e.fechaEstimadaLlegada ? [{ llegadaEstimada: e.fechaEstimadaLlegada, entregadoAt }] : [];
    });
    return puntualidadEnvios(items);
  }
}
