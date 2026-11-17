import { Body, Controller, Get, Param, Post, Sse, ServiceUnavailableException } from '@nestjs/common';
import { RolUsuario } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequestUser } from '../../common/interfaces/jwt-payload.interface';
import { TrackingEventsService } from './tracking-events.service';
import { CreateTrackingEventDto } from './dto/create-tracking-event.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('tracking-events')
@Controller('tracking-events')
export class TrackingEventsController {
  constructor(private readonly trackingEventsService: TrackingEventsService) {}

  @Post()
  create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('email') responsable: string,
    @Body() dto: CreateTrackingEventDto,
  ) {
    return this.trackingEventsService.create(tenantId, responsable, dto);
  }

  // Eventos nuevos del envío en tiempo real (Server-Sent Events). Se valida el acceso al abrir la conexión.
  @Get('shipment/:shipmentId/stream')
  @Roles(RolUsuario.admin_tenant, RolUsuario.operador, RolUsuario.super_admin, RolUsuario.cliente_final)
  @Sse()
  async streamEnvio(@CurrentUser() user: RequestUser, @Param('shipmentId') shipmentId: string) {
    await this.trackingEventsService.assertAccesoEnVivo(user, shipmentId);
    if (!this.trackingEventsService.hayCupoEnVivo()) throw new ServiceUnavailableException('Demasiadas conexiones abiertas; intenta de nuevo en unos minutos');
    return this.trackingEventsService.streamEnvio(user, shipmentId);
  }

  @Get('shipment/:shipmentId')
  @Roles(RolUsuario.admin_tenant, RolUsuario.operador, RolUsuario.super_admin, RolUsuario.cliente_final)
  findByShipment(@CurrentUser() user: RequestUser, @Param('shipmentId') shipmentId: string) {
    if (user.rol === RolUsuario.cliente_final) {
      return this.trackingEventsService.findByShipmentParaCliente(user.tenantId, user.email, shipmentId);
    }
    return this.trackingEventsService.findByShipment(user.tenantId, shipmentId);
  }
}
