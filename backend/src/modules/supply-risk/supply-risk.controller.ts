import { Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RiskMonitorService } from './risk-monitor.service';
import { SupplyRiskService } from './supply-risk.service';

// Planificación interna de la empresa: el cliente_final no tiene acceso.
@ApiTags('supply-risk')
@Roles(RolUsuario.admin_tenant, RolUsuario.operador, RolUsuario.super_admin)
@Controller('supply-risk')
export class SupplyRiskController {
  constructor(
    private readonly risk: SupplyRiskService,
    private readonly monitor: RiskMonitorService,
  ) {}

  @Get()
  evaluar(@CurrentUser('tenantId') tenantId: string) {
    return this.risk.evaluar(tenantId);
  }

  // Historial: cada vez que el semáforo de un SKU cambió.
  @Get('cambios')
  cambios(@CurrentUser('tenantId') tenantId: string) {
    return this.monitor.cambios(tenantId);
  }

  // Evalúa ahora (sin esperar la ronda programada) y registra los cambios.
  @Post('evaluar')
  async evaluarAhora(@CurrentUser('tenantId') tenantId: string) {
    const cambios = await this.monitor.evaluarEmpresa(tenantId);
    return { cambios };
  }
}
