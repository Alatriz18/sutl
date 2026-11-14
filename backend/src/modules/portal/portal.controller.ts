import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { RolUsuario } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequestUser } from '../../common/interfaces/jwt-payload.interface';
import { ConfirmarOrdenDto, CreateMensajeDto, QueryMensajesDto } from './dto/portal.dto';
import { PortalService } from './portal.service';

// Portal colaborativo: el equipo, el proveedor (sobre sus órdenes) y el cliente final
// (sobre sus envíos). Las reglas de quién ve qué están en PortalService.
@ApiTags('portal')
@Roles(RolUsuario.admin_tenant, RolUsuario.operador, RolUsuario.super_admin, RolUsuario.proveedor, RolUsuario.cliente_final)
@Controller('portal')
export class PortalController {
  constructor(private readonly portal: PortalService) {}

  @Get('mensajes')
  listar(@CurrentUser() user: RequestUser, @Query() q: QueryMensajesDto) {
    return this.portal.listar(user, q.entidadTipo, q.entidadId);
  }

  // Límite propio: un externo no puede inundar de correos al equipo.
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('mensajes')
  publicar(@CurrentUser() user: RequestUser, @Body() dto: CreateMensajeDto) {
    return this.portal.publicar(user, dto.entidadTipo, dto.entidadId, dto.texto);
  }

  // Solo el proveedor: confirma una orden emitida con su fecha de despacho.
  @Roles(RolUsuario.proveedor)
  @HttpCode(HttpStatus.OK)
  @Post('ordenes/:id/confirmar')
  confirmar(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ConfirmarOrdenDto) {
    return this.portal.confirmarOrden(user, id, dto.fechaConfirmada);
  }
}
