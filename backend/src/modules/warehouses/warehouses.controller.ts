import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { WarehousesService } from './warehouses.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { CreateLocationDto } from './dto/create-location.dto';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { CreateMovementDto } from './dto/create-movement.dto';

@Controller()
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Get('warehouses')
  findAll(@CurrentUser('tenantId') tenantId: string) {
    return this.warehousesService.findAll(tenantId);
  }

  @Get('warehouses/:id')
  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.warehousesService.findOne(tenantId, id);
  }

  @Post('warehouses')
  create(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateWarehouseDto) {
    return this.warehousesService.create(tenantId, dto);
  }

  @Post('warehouses/:id/locations')
  addLocation(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: CreateLocationDto,
  ) {
    return this.warehousesService.addLocation(tenantId, id, dto);
  }

  @Get('inventory-items')
  findAllItems(@CurrentUser('tenantId') tenantId: string) {
    return this.warehousesService.findAllItems(tenantId);
  }

  @Post('inventory-items')
  createItem(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateInventoryItemDto) {
    return this.warehousesService.createItem(tenantId, dto);
  }

  @Post('inventory-items/:id/movimientos')
  registrarMovimiento(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: CreateMovementDto,
  ) {
    return this.warehousesService.registrarMovimiento(tenantId, id, userId, dto);
  }
}
