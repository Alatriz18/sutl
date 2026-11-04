import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantConfigService } from './tenant-config.service';
import { UpdateTenantConfigDto } from './dto/update-tenant-config.dto';

// Configuración de la operación del propio tenant (siempre el del JWT, nunca
// por parámetro). La leen quienes operan (la UI adapta formularios a estas
// reglas); solo el admin del tenant la cambia.
@ApiTags('tenant-config')
@Controller('tenant-config')
export class TenantConfigController {
  constructor(private readonly tenantConfigService: TenantConfigService) {}

  @Get()
  @Roles(RolUsuario.admin_tenant, RolUsuario.operador, RolUsuario.super_admin)
  get(@CurrentUser('tenantId') tenantId: string) {
    return this.tenantConfigService.get(tenantId);
  }

  @Patch()
  @Roles(RolUsuario.admin_tenant, RolUsuario.super_admin)
  update(@CurrentUser('tenantId') tenantId: string, @Body() dto: UpdateTenantConfigDto) {
    return this.tenantConfigService.update(tenantId, dto);
  }
}
