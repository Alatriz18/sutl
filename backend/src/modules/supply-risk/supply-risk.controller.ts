import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { SupplyRiskService } from './supply-risk.service';

// Planificación interna de la empresa: el cliente_final no tiene acceso.
@ApiTags('supply-risk')
@Roles(RolUsuario.admin_tenant, RolUsuario.operador, RolUsuario.super_admin)
@Controller('supply-risk')
export class SupplyRiskController {
  constructor(private readonly risk: SupplyRiskService) {}

  @Get()
  evaluar(@CurrentUser('tenantId') tenantId: string) {
    return this.risk.evaluar(tenantId);
  }
}
