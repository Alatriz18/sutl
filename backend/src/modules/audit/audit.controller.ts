import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditService } from './audit.service';
import { AuditQueryDto } from './dto/audit-query.dto';

// La bitácora de la empresa la ve solo su administrador.
@ApiTags('audit')
@Roles(RolUsuario.admin_tenant, RolUsuario.super_admin)
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  listar(@CurrentUser('tenantId') tenantId: string, @Query() q: AuditQueryDto) {
    return this.audit.listar(tenantId, q);
  }
}
