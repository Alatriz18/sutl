import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(@CurrentUser('tenantId') tenantId: string) {
    return this.notificationsService.findAll(tenantId);
  }

  @Post()
  create(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateNotificationDto) {
    return this.notificationsService.create(tenantId, dto);
  }

  @Patch(':id/marcar-enviada')
  marcarEnviada(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.notificationsService.marcarEnviada(tenantId, id);
  }
}
