import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoOrdenCompra } from '@prisma/client';
import { validarFila } from '../../common/validate-row';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigOperacion } from '../tenant-config/tenant-config.defaults';
import { TenantConfigService } from '../tenant-config/tenant-config.service';
import { ImportInventoryPoliciesDto, UpsertInventoryPolicyDto } from './dto/inventory-policy.dto';

// OCs que todavía pueden traer mercadería.
const OC_ACTIVAS: EstadoOrdenCompra[] = ['emitida', 'confirmada', 'despachada', 'recibida_parcial'];

const redondear = (n: number, decimales = 1) => {
  const f = 10 ** decimales;
  return Math.round(n * f) / f;
};

export interface FilaCobertura {
  sku: string;
  descripcion: string | null;
  unidad: string | null;
  // Existencias actuales; null si la empresa lleva el inventario en su ERP y
  // todavía no reportó existencias para este SKU.
  stock: number | null;
  stockOrigen: 'sutl' | 'externo';
  consumoDiario: number | null;
  stockSeguridad: number | null;
  leadTimeDias: number | null;
  diasCobertura: number | null;
  bajoSeguridad: boolean;
  bajoCobertura: boolean;
  sinPolitica: boolean;
  unidadesMezcladas: boolean;
  // Lo que falta recibir de OCs vivas, lo que ya viaja en embarques y la
  // próxima llegada prevista: insumo del motor de riesgo.
  pendienteOc: number;
  enCamino: number;
  proximaEta: Date | null;
  policyId: string | null;
  existenciasExternasAt: Date | null;
}

@Injectable()
export class InventoryCoverageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantConfig: TenantConfigService,
  ) {}

  listarPoliticas(tenantId: string) {
    return this.prisma.inventoryPolicy.findMany({ where: { tenantId }, orderBy: { sku: 'asc' } });
  }

  // PUT: reemplaza los parámetros del SKU. Las existencias externas, si no
  // vienen, se conservan.
  async guardarPolitica(tenantId: string, dto: UpsertInventoryPolicyDto) {
    const sku = dto.sku.trim();
    if (!sku) {
      throw new BadRequestException('El SKU no puede estar vacío');
    }
    const config = await this.tenantConfig.getEfectiva(tenantId);
    this.assertExistencias(config, dto);
    const data = this.datos(dto);
    return this.prisma.inventoryPolicy.upsert({
      where: { tenantId_sku: { tenantId, sku } },
      create: { tenantId, sku, ...data },
      update: data,
    });
  }

  async eliminarPolitica(tenantId: string, id: string) {
    const { count } = await this.prisma.inventoryPolicy.deleteMany({ where: { id, tenantId } });
    if (count === 0) {
      throw new NotFoundException('Política de SKU no encontrada');
    }
    return { id };
  }

  // Importación masiva (Excel/CSV ya leído por la web). Cada fila se valida
  // con las mismas reglas que PUT; con simular=true no se guarda nada.
  async importar(tenantId: string, dto: ImportInventoryPoliciesDto) {
    const config = await this.tenantConfig.getEfectiva(tenantId);
    const vistos = new Map<string, number>();
    const resultado: { fila: number; sku: string | null; estado: 'ok' | 'error'; mensajes: string[] }[] = [];
    const validas: { sku: string; dto: UpsertInventoryPolicyDto }[] = [];

    dto.filas.forEach((plana, i) => {
      const fila = i + 1;
      const { valor, errores } = validarFila(UpsertInventoryPolicyDto, plana);
      const mensajes = [...errores];
      const sku = valor?.sku?.trim() || null;
      if (valor) {
        if (!sku) mensajes.push('El SKU no puede estar vacío');
        else if (vistos.has(sku)) mensajes.push(`SKU repetido en el archivo (ya aparece en la fila ${vistos.get(sku)})`);
        else vistos.set(sku, fila);
        try {
          this.assertExistencias(config, valor);
        } catch (e) {
          mensajes.push((e as Error).message);
        }
      }
      if (mensajes.length > 0 || !valor || !sku) {
        resultado.push({ fila, sku, estado: 'error', mensajes });
      } else {
        resultado.push({ fila, sku, estado: 'ok', mensajes: [] });
        validas.push({ sku, dto: valor });
      }
    });

    if (!dto.simular && validas.length > 0) {
      await this.prisma.$transaction(
        validas.map(({ sku, dto: v }) => {
          const data = this.datos(v);
          return this.prisma.inventoryPolicy.upsert({
            where: { tenantId_sku: { tenantId, sku } },
            create: { tenantId, sku, ...data },
            update: data,
          });
        }),
      );
    }

    return {
      simular: !!dto.simular,
      resumen: { total: dto.filas.length, aplicadas: dto.simular ? 0 : validas.length, validas: validas.length, conErrores: resultado.length - validas.length },
      filas: resultado,
    };
  }

  async cobertura(tenantId: string) {
    const config = await this.tenantConfig.getEfectiva(tenantId);
    const modoExterno = config.inventario.recepcionActualizaInventario === 'nunca';
    const umbral = config.inventario.diasCoberturaAlerta;

    const [politicas, inventario, lineas] = await Promise.all([
      this.prisma.inventoryPolicy.findMany({ where: { tenantId } }),
      this.prisma.inventoryItem.findMany({
        where: { tenantId, sku: { not: null } },
        select: { sku: true, descripcion: true, unidad: true, cantidad: true },
      }),
      this.prisma.purchaseOrderLine.findMany({
        where: { tenantId, purchaseOrder: { estado: { in: OC_ACTIVAS } } },
        select: {
          sku: true,
          descripcion: true,
          unidad: true,
          cantidad: true,
          cantidadRecibida: true,
          embarques: {
            select: { cantidad: true, shipment: { select: { estado: true, fechaEstimadaLlegada: true } } },
          },
        },
      }),
    ]);

    type Acum = {
      descripcion: string | null;
      unidad: string | null;
      unidades: Set<string>;
      stockSutl: number;
      pendienteOc: number;
      enCamino: number;
      proximaEta: Date | null;
    };
    const porSku = new Map<string, Acum>();
    const acum = (sku: string): Acum => {
      let a = porSku.get(sku);
      if (!a) {
        a = { descripcion: null, unidad: null, unidades: new Set(), stockSutl: 0, pendienteOc: 0, enCamino: 0, proximaEta: null };
        porSku.set(sku, a);
      }
      return a;
    };

    for (const it of inventario) {
      const a = acum(it.sku!);
      a.stockSutl += it.cantidad;
      a.descripcion ??= it.descripcion;
      a.unidad ??= it.unidad;
      a.unidades.add(it.unidad);
    }
    for (const l of lineas) {
      const a = acum(l.sku);
      const pendiente = Math.max(l.cantidad - l.cantidadRecibida, 0);
      const enRuta = l.embarques.filter((e) => e.shipment.estado !== 'entregado');
      a.pendienteOc += pendiente;
      a.enCamino += Math.min(
        enRuta.reduce((s, e) => s + e.cantidad, 0),
        pendiente,
      );
      for (const e of enRuta) {
        const eta = e.shipment.fechaEstimadaLlegada;
        if (eta && (!a.proximaEta || eta < a.proximaEta)) a.proximaEta = eta;
      }
      a.descripcion ??= l.descripcion;
      a.unidad ??= l.unidad;
    }
    for (const p of politicas) acum(p.sku);

    const politicaPorSku = new Map(politicas.map((p) => [p.sku, p]));
    const filas: FilaCobertura[] = [...porSku.entries()].map(([sku, a]) => {
      const p = politicaPorSku.get(sku) ?? null;
      const stock = modoExterno ? (p?.existenciasExternas ?? null) : a.stockSutl;
      const consumo = p?.consumoDiario ?? null;
      const diasCobertura = stock != null && consumo != null && consumo > 0 ? redondear(stock / consumo) : null;
      return {
        sku,
        descripcion: a.descripcion,
        unidad: a.unidad,
        stock,
        stockOrigen: modoExterno ? 'externo' : 'sutl',
        consumoDiario: consumo,
        stockSeguridad: p?.stockSeguridad ?? null,
        leadTimeDias: p?.leadTimeDias ?? null,
        diasCobertura,
        bajoSeguridad: !!p && p.stockSeguridad > 0 && stock != null && stock < p.stockSeguridad,
        bajoCobertura: diasCobertura != null && diasCobertura < umbral,
        sinPolitica: !p,
        unidadesMezcladas: a.unidades.size > 1,
        pendienteOc: redondear(a.pendienteOc, 4),
        enCamino: redondear(a.enCamino, 4),
        proximaEta: a.proximaEta,
        policyId: p?.id ?? null,
        existenciasExternasAt: p?.existenciasExternasAt ?? null,
      };
    });

    // Primero lo que requiere atención; después por menor cobertura.
    const riesgo = (f: FilaCobertura) => (f.bajoSeguridad || f.bajoCobertura ? 0 : 1);
    filas.sort(
      (x, y) =>
        riesgo(x) - riesgo(y) ||
        (x.diasCobertura ?? Infinity) - (y.diasCobertura ?? Infinity) ||
        x.sku.localeCompare(y.sku),
    );

    return {
      umbralDias: umbral,
      modoInventario: config.inventario.recepcionActualizaInventario,
      resumen: {
        skus: filas.length,
        conPolitica: filas.filter((f) => !f.sinPolitica).length,
        sinPolitica: filas.filter((f) => f.sinPolitica).length,
        bajoSeguridad: filas.filter((f) => f.bajoSeguridad).length,
        bajoCobertura: filas.filter((f) => f.bajoCobertura).length,
      },
      filas,
    };
  }

  private datos(dto: UpsertInventoryPolicyDto) {
    return {
      consumoDiario: dto.consumoDiario,
      stockSeguridad: dto.stockSeguridad ?? 0,
      leadTimeDias: dto.leadTimeDias ?? null,
      ...(dto.existenciasExternas !== undefined
        ? { existenciasExternas: dto.existenciasExternas, existenciasExternasAt: new Date() }
        : {}),
    };
  }

  // Las existencias externas solo tienen sentido si el inventario vive en el
  // ERP del cliente; si no, el stock sale de Almacén y aceptarlas confundiría.
  private assertExistencias(config: ConfigOperacion, dto: Pick<UpsertInventoryPolicyDto, 'existenciasExternas'>) {
    if (dto.existenciasExternas !== undefined && config.inventario.recepcionActualizaInventario !== 'nunca') {
      throw new BadRequestException(
        'Tu empresa lleva el inventario en SUTL: las existencias se calculan desde Almacén. Las existencias externas solo aplican si configuras que el inventario vive en otro sistema',
      );
    }
  }
}
