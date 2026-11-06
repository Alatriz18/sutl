import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { InventoryCoverageService } from './inventory-coverage.service';
import { ImportInventoryPoliciesDto, UpsertInventoryPolicyDto } from './dto/inventory-policy.dto';

// Datos de planificación internos de la empresa: el cliente_final no tiene acceso.
@ApiTags('inventory-coverage')
@Roles(RolUsuario.admin_tenant, RolUsuario.operador, RolUsuario.super_admin)
@Controller()
export class InventoryCoverageController {
  constructor(private readonly coverageService: InventoryCoverageService) {}

  @Get('inventory-coverage')
  cobertura(@CurrentUser('tenantId') tenantId: string) {
    return this.coverageService.cobertura(tenantId);
  }

  @Get('inventory-policies')
  listar(@CurrentUser('tenantId') tenantId: string) {
    return this.coverageService.listarPoliticas(tenantId);
  }

  @Put('inventory-policies')
  guardar(@CurrentUser('tenantId') tenantId: string, @Body() dto: UpsertInventoryPolicyDto) {
    return this.coverageService.guardarPolitica(tenantId, dto);
  }

  // Antes de ':id' para que "importar" no se tome como un id.
  @Post('inventory-policies/importar')
  importar(@CurrentUser('tenantId') tenantId: string, @Body() dto: ImportInventoryPoliciesDto) {
    return this.coverageService.importar(tenantId, dto);
  }

  @Delete('inventory-policies/:id')
  eliminar(@CurrentUser('tenantId') tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.coverageService.eliminarPolitica(tenantId, id);
  }
}
