import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ControlTowerService } from './control-tower.service';

// Gestión interna de la empresa: el cliente_final no tiene acceso.
@ApiTags('control-tower')
@Roles(RolUsuario.admin_tenant, RolUsuario.operador, RolUsuario.super_admin)
@Controller('control-tower')
export class ControlTowerController {
  constructor(private readonly tower: ControlTowerService) {}

  @Get()
  resumen(@CurrentUser('tenantId') tenantId: string, @CurrentUser('userId') userId: string) {
    return this.tower.resumen(tenantId, userId);
  }
}
