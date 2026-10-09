import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { CreateLocationDto } from './dto/create-location.dto';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { CreateMovementDto } from './dto/create-movement.dto';

@Injectable()
export class WarehousesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(tenantId: string) {
    return this.prisma.warehouse.findMany({
      where: { tenantId },
      include: { ubicaciones: true, _count: { select: { items: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id, tenantId },
      include: { ubicaciones: true },
    });
    if (!warehouse) {
      throw new NotFoundException('Bodega no encontrada');
    }
    return warehouse;
  }

  create(tenantId: string, dto: CreateWarehouseDto) {
    return this.prisma.warehouse.create({ data: { ...dto, tenantId } });
  }

  async addLocation(tenantId: string, warehouseId: string, dto: CreateLocationDto) {
    await this.findOne(tenantId, warehouseId);
    return this.prisma.warehouseLocation.create({ data: { ...dto, warehouseId } });
  }

  findAllItems(tenantId: string) {
    return this.prisma.inventoryItem.findMany({
      where: { tenantId },
      include: { warehouse: true, ubicacion: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createItem(tenantId: string, dto: CreateInventoryItemDto) {
    await this.findOne(tenantId, dto.warehouseId);
    return this.prisma.inventoryItem.create({
      data: { ...dto, tenantId },
      include: { warehouse: true, ubicacion: true },
    });
  }

  // Registra un movimiento y ajusta la cantidad en stock del ítem.
  async registrarMovimiento(
    tenantId: string,
    itemId: string,
    responsableId: string,
    dto: CreateMovementDto,
  ) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id: itemId, tenantId },
    });
    if (!item) {
      throw new NotFoundException('Ítem de inventario no encontrado');
    }

    let nuevaCantidad = item.cantidad;
    if (dto.tipo === 'entrada') {
      nuevaCantidad += dto.cantidad;
    } else if (dto.tipo === 'salida') {
      if (dto.cantidad > item.cantidad) {
        throw new BadRequestException('No hay suficiente stock para esta salida');
      }
      nuevaCantidad -= dto.cantidad;
    }

    const [movimiento] = await this.prisma.$transaction([
      this.prisma.stockMovement.create({
        data: { ...dto, tenantId, inventoryItemId: itemId, responsableId },
      }),
      this.prisma.inventoryItem.update({
        where: { id: itemId },
        data: { cantidad: nuevaCantidad },
      }),
    ]);

    return movimiento;
  }
}
