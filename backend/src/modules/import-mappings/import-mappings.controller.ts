import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsObject } from 'class-validator';
import { RolUsuario } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ImportMappingsService } from './import-mappings.service';

export class SaveImportMappingDto {
  @IsObject()
  mapeo: Record<string, unknown>;
}

// El mapeo de columnas es de la empresa (siempre el tenant del JWT).
@ApiTags('import-mappings')
@Roles(RolUsuario.admin_tenant, RolUsuario.operador, RolUsuario.super_admin)
@Controller('import-mappings')
export class ImportMappingsController {
  constructor(private readonly mappingsService: ImportMappingsService) {}

  @Get(':tipo')
  obtener(@CurrentUser('tenantId') tenantId: string, @Param('tipo') tipo: string) {
    return this.mappingsService.obtener(tenantId, tipo);
  }

  @Put(':tipo')
  guardar(
    @CurrentUser('tenantId') tenantId: string,
    @Param('tipo') tipo: string,
    @Body() dto: SaveImportMappingDto,
  ) {
    return this.mappingsService.guardar(tenantId, tipo, dto.mapeo);
  }
}
