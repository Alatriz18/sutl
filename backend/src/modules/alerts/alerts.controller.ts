import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AlertsService } from './alerts.service';
import { CreateAlertDto } from './dto/create-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';

@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  findAll(@CurrentUser('tenantId') tenantId: string) {
    return this.alertsService.findAll(tenantId);
  }

  @Get('evaluar')
  evaluar(@CurrentUser('tenantId') tenantId: string) {
    return this.alertsService.evaluar(tenantId);
  }

  @Post()
  create(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateAlertDto) {
    return this.alertsService.create(tenantId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAlertDto,
  ) {
    return this.alertsService.update(tenantId, id, dto);
  }
}
