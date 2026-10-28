import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoOrdenCompra, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePurchaseOrderDto, PurchaseOrderLineDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { TransitionPurchaseOrderDto } from './dto/transition-purchase-order.dto';
import { RegisterReceiptDto } from './dto/register-receipt.dto';
import { QueryPurchaseOrdersDto } from './dto/query-purchase-orders.dto';

// Ciclo de vida de la OC. recibida_parcial / recibida solo se alcanzan
// registrando recepciones; recibida y cancelada son estados finales.
export const TRANSICIONES: Record<EstadoOrdenCompra, EstadoOrdenCompra[]> = {
  borrador: ['emitida', 'cancelada'],
  emitida: ['confirmada', 'cancelada'],
  confirmada: ['despachada', 'cancelada'],
  despachada: [],
  recibida_parcial: [],
  recibida: [],
  cancelada: [],
};

// Un proveedor local puede entregar sin "despacho" internacional, por eso
// también se acepta recibir desde confirmada.
const ESTADOS_RECEPCION: EstadoOrdenCompra[] = ['confirmada', 'despachada', 'recibida_parcial'];
const ESTADOS_CERRADOS: EstadoOrdenCompra[] = ['recibida', 'cancelada'];

// Tolerancia para comparar cantidades decimales (kg, m3) guardadas como float.
const EPSILON = 1e-9;

const INCLUDE_DETALLE = {
  proveedor: { select: { id: true, nombre: true, taxId: true, email: true, contactoNombre: true } },
  lineas: {
    orderBy: { createdAt: 'asc' },
    include: { recepciones: { orderBy: { fecha: 'desc' } } },
  },
} satisfies Prisma.PurchaseOrderInclude;

@Injectable()
export class PurchaseOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(tenantId: string, query: QueryPurchaseOrdersDto = {}) {
    const where: Prisma.PurchaseOrderWhereInput = { tenantId };
    if (query.estado) where.estado = query.estado;
    if (query.proveedorId) where.proveedorId = query.proveedorId;
    if (query.q) {
      where.OR = [
        { numero: { contains: query.q, mode: 'insensitive' } },
        { lineas: { some: { sku: { contains: query.q, mode: 'insensitive' } } } },
      ];
    }
    return this.prisma.purchaseOrder.findMany({
      where,
      include: {
        proveedor: { select: { id: true, nombre: true } },
        lineas: {
          select: { id: true, sku: true, cantidad: true, cantidadRecibida: true, precioUnitario: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const orden = await this.prisma.purchaseOrder.findFirst({
      where: { id, tenantId },
      include: INCLUDE_DETALLE,
    });
    if (!orden) {
      throw new NotFoundException('Orden de compra no encontrada');
    }
    return orden;
  }

  async create(tenantId: string, userId: string, dto: CreatePurchaseOrderDto) {
    await this.assertProveedor(tenantId, dto.proveedorId);
    const { lineas, ...cabecera } = dto;
    try {
      return await this.prisma.purchaseOrder.create({
        data: {
          ...cabecera,
          moneda: cabecera.moneda?.toUpperCase(),
          tenantId,
          creadoPorId: userId,
          lineas: { create: lineas.map((l) => this.lineaData(tenantId, l)) },
        },
        include: INCLUDE_DETALLE,
      });
    } catch (e) {
      throw this.mapUniqueError(e);
    }
  }

  async update(tenantId: string, id: string, dto: UpdatePurchaseOrderDto) {
    const orden = await this.findOne(tenantId, id);

    if (ESTADOS_CERRADOS.includes(orden.estado)) {
      throw new BadRequestException(`La OC está ${orden.estado} y ya no se puede modificar`);
    }
    const soloBorrador = (['numero', 'proveedorId', 'moneda', 'lineas'] as const).filter(
      (campo) => dto[campo] !== undefined,
    );
    if (orden.estado !== 'borrador' && soloBorrador.length > 0) {
      throw new BadRequestException(
        `${soloBorrador.join(', ')} solo se puede cambiar mientras la OC está en borrador`,
      );
    }
    if (dto.proveedorId) {
      await this.assertProveedor(tenantId, dto.proveedorId);
    }

    const { lineas, ...cabecera } = dto;
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (lineas) {
          await tx.purchaseOrderLine.deleteMany({ where: { purchaseOrderId: id, tenantId } });
          await tx.purchaseOrderLine.createMany({
            data: lineas.map((l) => ({ ...this.lineaData(tenantId, l), purchaseOrderId: id })),
          });
        }
        return tx.purchaseOrder.update({
          where: { id, tenantId },
          data: { ...cabecera, moneda: cabecera.moneda?.toUpperCase() },
          include: INCLUDE_DETALLE,
        });
      });
    } catch (e) {
      throw this.mapUniqueError(e);
    }
  }

  async transicion(tenantId: string, id: string, dto: TransitionPurchaseOrderDto) {
    const orden = await this.findOne(tenantId, id);
    const destino = dto.estado;

    if (!TRANSICIONES[orden.estado].includes(destino)) {
      throw new BadRequestException(`No se puede pasar una OC de ${orden.estado} a ${destino}`);
    }

    const data: Prisma.PurchaseOrderUpdateManyMutationInput = { estado: destino };
    if (destino === 'confirmada') {
      const fecha = dto.fechaConfirmadaProveedor ?? orden.fechaConfirmadaProveedor;
      if (!fecha) {
        throw new BadRequestException(
          'Para confirmar la OC indica la fecha comprometida por el proveedor (fechaConfirmadaProveedor)',
        );
      }
      data.fechaConfirmadaProveedor = fecha;
    }
    if (destino === 'despachada') {
      data.fechaDespacho = dto.fechaDespacho ?? new Date();
    }
    if (destino === 'cancelada') {
      if (!dto.motivo) {
        throw new BadRequestException('Indica el motivo de la cancelación');
      }
      data.motivoCancelacion = dto.motivo;
    }

    // El estado actual va en el where: si otra petición cambió la OC entre
    // la lectura y la escritura, no se pisa — se responde 409.
    const { count } = await this.prisma.purchaseOrder.updateMany({
      where: { id, tenantId, estado: orden.estado },
      data,
    });
    if (count === 0) {
      throw new ConflictException('La OC cambió de estado mientras tanto; vuelve a cargarla');
    }
    return this.findOne(tenantId, id);
  }

  async registrarRecepcion(
    tenantId: string,
    userId: string,
    id: string,
    dto: RegisterReceiptDto,
  ) {
    const orden = await this.findOne(tenantId, id);

    if (!ESTADOS_RECEPCION.includes(orden.estado)) {
      throw new BadRequestException(
        `No se puede registrar recepción en una OC ${orden.estado} (debe estar confirmada o despachada)`,
      );
    }
    const lineasPorId = new Map(orden.lineas.map((l) => [l.id, l]));
    for (const item of dto.lineas) {
      if (!lineasPorId.has(item.lineaId)) {
        throw new BadRequestException(`La línea ${item.lineaId} no pertenece a esta OC`);
      }
    }

    await this.prisma.$transaction(async (tx) => {
      for (const item of dto.lineas) {
        const linea = lineasPorId.get(item.lineaId)!;
        // Incremento condicional y atómico: dos recepciones simultáneas no
        // pueden sumar más de lo pedido.
        const { count } = await tx.purchaseOrderLine.updateMany({
          where: {
            id: item.lineaId,
            tenantId,
            purchaseOrderId: id,
            cantidadRecibida: { lte: linea.cantidad - item.cantidad + EPSILON },
          },
          data: { cantidadRecibida: { increment: item.cantidad } },
        });
        if (count === 0) {
          throw new BadRequestException(
            `La recepción de ${linea.sku} excede la cantidad pendiente de la OC`,
          );
        }
        await tx.purchaseOrderReceipt.create({
          data: {
            tenantId,
            purchaseOrderLineId: item.lineaId,
            cantidad: item.cantidad,
            responsableId: userId,
            notas: dto.notas,
          },
        });
      }

      const lineas = await tx.purchaseOrderLine.findMany({
        where: { purchaseOrderId: id, tenantId },
        select: { cantidad: true, cantidadRecibida: true },
      });
      const completa = lineas.every((l) => l.cantidadRecibida + EPSILON >= l.cantidad);

      const { count } = await tx.purchaseOrder.updateMany({
        where: { id, tenantId, estado: { in: ESTADOS_RECEPCION } },
        data: { estado: completa ? 'recibida' : 'recibida_parcial' },
      });
      if (count === 0) {
        throw new ConflictException('La OC cambió de estado mientras tanto; vuelve a cargarla');
      }
    });

    return this.findOne(tenantId, id);
  }

  // El proveedor debe ser un Partner de tipo proveedor del mismo tenant.
  // Respuesta genérica: no revela si el id existe en otro tenant.
  private async assertProveedor(tenantId: string, proveedorId: string) {
    const proveedor = await this.prisma.partner.findFirst({
      where: { id: proveedorId, tenantId, tipo: 'proveedor', activo: true },
      select: { id: true },
    });
    if (!proveedor) {
      throw new BadRequestException('proveedorId no corresponde a un proveedor activo de tu empresa');
    }
  }

  private lineaData(tenantId: string, l: PurchaseOrderLineDto) {
    return {
      tenantId,
      sku: l.sku.trim(),
      descripcion: l.descripcion,
      cantidad: l.cantidad,
      unidad: l.unidad,
      precioUnitario: l.precioUnitario,
    };
  }

  private mapUniqueError(e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return new ConflictException('Ya existe una OC con ese número en tu empresa');
    }
    return e;
  }
}
