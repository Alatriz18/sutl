import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';

// Enviar mensajes a terceros es una acción de la empresa: el cliente_final no la usa.
@ApiTags('notifications')
@Roles(RolUsuario.admin_tenant, RolUsuario.operador, RolUsuario.super_admin)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(@CurrentUser('tenantId') tenantId: string) {
    return this.notificationsService.findAll(tenantId);
  }

  @Get('canales')
  canales() {
    return this.notificationsService.canales();
  }

  @Post()
  create(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateNotificationDto) {
    return this.notificationsService.create(tenantId, dto);
  }

  @Post(':id/reenviar')
  reenviar(@CurrentUser('tenantId') tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.notificationsService.reenviar(tenantId, id);
  }
}
