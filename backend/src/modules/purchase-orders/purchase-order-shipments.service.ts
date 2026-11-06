import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoOrdenCompra, Prisma } from '@prisma/client';
import { assertTenantRefs } from '../../common/tenant-refs';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantConfigService } from '../tenant-config/tenant-config.service';
import { LinkShipmentDto } from './dto/link-shipment.dto';
import { PurchaseOrdersService } from './purchase-orders.service';

// Solo se puede asignar carga a un embarque mientras la OC está viva: ya
// emitida al proveedor y todavía sin cerrar.
const ESTADOS_VINCULO: EstadoOrdenCompra[] = ['emitida', 'confirmada', 'despachada', 'recibida_parcial'];

// Tolerancia para comparar cantidades decimales (kg, m3) guardadas como float.
const EPSILON = 1e-9;

// Vínculo OC ↔ embarque: qué cantidad de cada línea de OC viaja en cada
// embarque. Una línea puede repartirse en varios embarques y un embarque
// puede traer líneas de varias OCs.
@Injectable()
export class PurchaseOrderShipmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantConfig: TenantConfigService,
    private readonly orders: PurchaseOrdersService,
  ) {}

  async vincular(tenantId: string, ocId: string, dto: LinkShipmentDto) {
    const orden = await this.orders.findOne(tenantId, ocId);

    if (!ESTADOS_VINCULO.includes(orden.estado)) {
      throw new BadRequestException(
        `No se puede vincular un embarque a una OC ${orden.estado} (debe estar emitida, confirmada o despachada)`,
      );
    }
    await assertTenantRefs(this.prisma, tenantId, { shipmentId: dto.shipmentId });
    const embarque = await this.prisma.shipment.findFirst({
      where: { id: dto.shipmentId, tenantId },
      select: { estado: true, codigoGuia: true },
    });
    if (!embarque || embarque.estado === 'entregado') {
      throw new BadRequestException('El embarque ya fue entregado y no admite más carga');
    }

    const lineasPorId = new Map(orden.lineas.map((l) => [l.id, l]));
    const vistos = new Set<string>();
    for (const item of dto.lineas) {
      if (!lineasPorId.has(item.lineaId)) {
        throw new BadRequestException(`La línea ${item.lineaId} no pertenece a esta OC`);
      }
      if (vistos.has(item.lineaId)) {
        throw new BadRequestException(`La línea ${item.lineaId} está repetida en la solicitud`);
      }
      vistos.add(item.lineaId);
    }

    const config = await this.tenantConfig.getEfectiva(tenantId);
    const factor = 1 + config.compras.toleranciaSobreRecepcionPct / 100;

    await this.prisma.$transaction(async (tx) => {
      // Bloquea las líneas (en orden estable) para que dos asignaciones
      // simultáneas no sumen más de lo pedido.
      const ids = [...vistos].sort();
      await tx.$queryRaw`SELECT id FROM purchase_order_lines WHERE "tenantId" = ${tenantId} AND id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`;

      for (const item of dto.lineas) {
        const linea = lineasPorId.get(item.lineaId)!;
        const otros = await tx.shipmentPurchaseOrderLine.aggregate({
          where: {
            tenantId,
            purchaseOrderLineId: item.lineaId,
            shipmentId: { not: dto.shipmentId },
          },
          _sum: { cantidad: true },
        });
        const asignadoEnOtros = otros._sum.cantidad ?? 0;
        if (asignadoEnOtros + item.cantidad > linea.cantidad * factor + EPSILON) {
          const disponible = Math.max(linea.cantidad * factor - asignadoEnOtros, 0);
          throw new BadRequestException(
            `La asignación de ${linea.sku} excede lo pedido: ya hay ${asignadoEnOtros} en otros embarques y solo quedan ${Math.round(disponible * 10000) / 10000} por asignar`,
          );
        }
        if (item.cantidad === 0) {
          await tx.shipmentPurchaseOrderLine.deleteMany({
            where: { tenantId, shipmentId: dto.shipmentId, purchaseOrderLineId: item.lineaId },
          });
        } else {
          await tx.shipmentPurchaseOrderLine.upsert({
            where: {
              shipmentId_purchaseOrderLineId: {
                shipmentId: dto.shipmentId,
                purchaseOrderLineId: item.lineaId,
              },
            },
            create: {
              tenantId,
              shipmentId: dto.shipmentId,
              purchaseOrderLineId: item.lineaId,
              cantidad: item.cantidad,
            },
            update: { cantidad: item.cantidad },
          });
        }
      }

      // Regla configurable: vincular un embarque a una OC confirmada indica
      // que el proveedor ya entregó la carga al transportista. El estado va
      // en el where para no pisar un cambio simultáneo.
      if (config.compras.vincularEmbarqueDespachaOc && orden.estado === 'confirmada') {
        const quedan = await tx.shipmentPurchaseOrderLine.count({
          where: { tenantId, linea: { purchaseOrderId: ocId } },
        });
        if (quedan > 0) {
          await tx.purchaseOrder.updateMany({
            where: { id: ocId, tenantId, estado: 'confirmada' },
            data: { estado: 'despachada', fechaDespacho: new Date() },
          });
        }
      }
    });

    return this.orders.findOne(tenantId, ocId);
  }

  async desvincular(tenantId: string, ocId: string, shipmentId: string) {
    await this.orders.findOne(tenantId, ocId);
    const { count } = await this.prisma.shipmentPurchaseOrderLine.deleteMany({
      where: { tenantId, shipmentId, linea: { purchaseOrderId: ocId } },
    });
    if (count === 0) {
      throw new NotFoundException('Ese embarque no tiene carga de esta OC');
    }
    return this.orders.findOne(tenantId, ocId);
  }
}
