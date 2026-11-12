import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateWebhookDto, UpdateWebhookDto } from './dto/webhook.dto';
import { EVENTOS_WEBHOOK } from './webhook-events';
import { WebhooksService } from './webhooks.service';

// Gestionar integraciones es administración de la empresa: solo admin_tenant.
@ApiTags('webhooks')
@Roles(RolUsuario.admin_tenant, RolUsuario.super_admin)
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Get()
  listar(@CurrentUser('tenantId') tenantId: string) {
    return this.webhooks.listar(tenantId);
  }

  @Get('eventos')
  eventos() {
    return EVENTOS_WEBHOOK;
  }

  @Post()
  crear(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateWebhookDto) {
    return this.webhooks.crear(tenantId, dto);
  }

  @Patch(':id')
  actualizar(@CurrentUser('tenantId') tenantId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateWebhookDto) {
    return this.webhooks.actualizar(tenantId, id, dto);
  }

  @Delete(':id')
  eliminar(@CurrentUser('tenantId') tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.webhooks.eliminar(tenantId, id);
  }

  @Post(':id/probar')
  probar(@CurrentUser('tenantId') tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.webhooks.probar(tenantId, id);
  }

  @Get(':id/entregas')
  entregas(@CurrentUser('tenantId') tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.webhooks.entregas(tenantId, id);
  }
}
