import { Injectable } from '@nestjs/common';
import { EstadoOrdenCompra } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryCoverageService } from '../inventory-coverage/inventory-coverage.service';
import { AccionRecomendada, Reposicion, ResultadoRiesgo, Semaforo, evaluarRiesgo } from './risk-engine';

const OC_ACTIVAS: EstadoOrdenCompra[] = ['emitida', 'confirmada', 'despachada', 'recibida_parcial'];

const ORDEN: Record<Semaforo, number> = { rojo: 0, amarillo: 1, verde: 2, sin_datos: 3 };

export interface FilaRiesgo extends ResultadoRiesgo {
  sku: string;
  descripcion: string | null;
  unidad: string | null;
  stock: number | null;
  consumoDiario: number | null;
  diasCobertura: number | null;
  stockSeguridad: number | null;
  leadTimeDias: number | null;
  reposiciones: { origen: 'embarque' | 'oc'; referencia: string; cantidad: number; fecha: Date | null }[];
}

@Injectable()
export class SupplyRiskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coverage: InventoryCoverageService,
  ) {}

  // `hoy` se inyecta para poder probar con fechas fijas.
  async evaluar(tenantId: string, hoy = new Date()) {
    const cobertura = await this.coverage.cobertura(tenantId);
    const lineas = await this.prisma.purchaseOrderLine.findMany({
      where: { tenantId, purchaseOrder: { estado: { in: OC_ACTIVAS } } },
      select: {
        sku: true,
        cantidad: true,
        cantidadRecibida: true,
        purchaseOrder: { select: { numero: true } },
        embarques: {
          select: { cantidad: true, shipment: { select: { codigoGuia: true, estado: true, fechaEstimadaLlegada: true } } },
        },
      },
    });

    // Reposiciones esperadas por SKU: cada embarque en camino con su ETA y,
    // lo pendiente que todavía no viaja, como OC sin fecha de llegada.
    const porSku = new Map<string, Reposicion[]>();
    const agregar = (sku: string, r: Reposicion) => {
      const lista = porSku.get(sku) ?? [];
      lista.push(r);
      porSku.set(sku, lista);
    };
    for (const l of lineas) {
      let pendiente = Math.max(l.cantidad - l.cantidadRecibida, 0);
      for (const e of l.embarques.filter((x) => x.shipment.estado !== 'entregado')) {
        const cantidad = Math.min(e.cantidad, pendiente);
        if (cantidad <= 0) continue;
        pendiente -= cantidad;
        agregar(l.sku, {
          fecha: e.shipment.fechaEstimadaLlegada,
          cantidad,
          origen: 'embarque',
          referencia: e.shipment.codigoGuia,
        });
      }
      if (pendiente > 0) {
        agregar(l.sku, { fecha: null, cantidad: pendiente, origen: 'oc', referencia: l.purchaseOrder.numero });
      }
    }

    const filas: FilaRiesgo[] = cobertura.filas.map((f) => {
      const reposiciones = porSku.get(f.sku) ?? [];
      const r = f.sinPolitica
        ? ({
            semaforo: 'sin_datos',
            accion: 'ninguna',
            motivo: 'Este SKU no tiene política de inventario (consumo diario y stock de seguridad).',
            fechaQuiebre: null,
            diasSinStock: 0,
            cubiertoHasta: null,
            fechaBajoSeguridad: null,
            reposicionesSinFecha: 0,
            reposicionesVencidas: 0,
          } satisfies ResultadoRiesgo)
        : evaluarRiesgo({
            hoy,
            stock: f.stock,
            consumoDiario: f.consumoDiario,
            stockSeguridad: f.stockSeguridad ?? 0,
            leadTimeDias: f.leadTimeDias,
            diasCoberturaAlerta: cobertura.umbralDias,
            reposiciones,
          });
      return {
        ...r,
        sku: f.sku,
        descripcion: f.descripcion,
        unidad: f.unidad,
        stock: f.stock,
        consumoDiario: f.consumoDiario,
        diasCobertura: f.diasCobertura,
        stockSeguridad: f.stockSeguridad,
        leadTimeDias: f.leadTimeDias,
        reposiciones,
      };
    });

    filas.sort(
      (a, b) =>
        ORDEN[a.semaforo] - ORDEN[b.semaforo] ||
        (a.fechaQuiebre?.getTime() ?? Infinity) - (b.fechaQuiebre?.getTime() ?? Infinity) ||
        a.sku.localeCompare(b.sku),
    );

    const cuenta = (s: Semaforo) => filas.filter((f) => f.semaforo === s).length;
    const acciones: Partial<Record<AccionRecomendada, number>> = {};
    for (const f of filas) if (f.accion !== 'ninguna') acciones[f.accion] = (acciones[f.accion] ?? 0) + 1;

    return {
      evaluadoAt: hoy,
      umbralDias: cobertura.umbralDias,
      resumen: { rojo: cuenta('rojo'), amarillo: cuenta('amarillo'), verde: cuenta('verde'), sinDatos: cuenta('sin_datos'), acciones },
      filas,
    };
  }
}
