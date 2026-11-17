import { Body, Controller, Get, Param, Patch, Post, Sse } from '@nestjs/common';
import { RolUsuario } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequestUser } from '../../common/interfaces/jwt-payload.interface';
import { Public } from '../../common/decorators/public.decorator';
import { ShipmentsService } from './shipments.service';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('shipments')
@Controller('shipments')
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  // Portal público de seguimiento — debe ir antes de ':id' para no chocar con esa ruta.
  @Public()
  @Get('tracking/:codigoGuia')
  track(@Param('codigoGuia') codigoGuia: string) {
    return this.shipmentsService.trackByCodigoGuia(codigoGuia);
  }

  // Lo mismo, en tiempo real (Server-Sent Events): la página pública se actualiza sola.
  @Public()
  @Sse('tracking/:codigoGuia/stream')
  streamTrack(@Param('codigoGuia') codigoGuia: string) {
    return this.shipmentsService.streamPublico(codigoGuia);
  }

  // El cliente final (destinatario) entra al portal y ve solo SUS envíos, sin datos internos.
  @Get()
  @Roles(RolUsuario.admin_tenant, RolUsuario.operador, RolUsuario.super_admin, RolUsuario.cliente_final)
  findAll(@CurrentUser() user: RequestUser) {
    if (user.rol === RolUsuario.cliente_final) return this.shipmentsService.findAllDeCliente(user.tenantId, user.email);
    return this.shipmentsService.findAll(user.tenantId);
  }

  @Get(':id')
  @Roles(RolUsuario.admin_tenant, RolUsuario.operador, RolUsuario.super_admin, RolUsuario.cliente_final)
  findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    if (user.rol === RolUsuario.cliente_final) return this.shipmentsService.findOneDeCliente(user.tenantId, user.email, id);
    return this.shipmentsService.findOne(user.tenantId, id);
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
