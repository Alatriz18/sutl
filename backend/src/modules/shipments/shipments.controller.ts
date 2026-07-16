import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ShipmentsService } from './shipments.service';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';

@Controller('shipments')
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  // Portal público de seguimiento — debe ir antes de ':id' para no chocar con esa ruta.
  @Public()
  @Get('tracking/:codigoGuia')
  track(@Param('codigoGuia') codigoGuia: string) {
    return this.shipmentsService.trackByCodigoGuia(codigoGuia);
  }

  @Get()
  findAll(@CurrentUser('tenantId') tenantId: string) {
    return this.shipmentsService.findAll(tenantId);
  }

  @Get(':id')
  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.shipmentsService.findOne(tenantId, id);
  }

  @Post()
  create(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateShipmentDto) {
    return this.shipmentsService.create(tenantId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateShipmentDto,
  ) {
    return this.shipmentsService.update(tenantId, id, dto);
  }
}
