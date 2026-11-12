import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { RolUsuario } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiKeysService } from './api-keys.service';

export class CreateApiKeyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  nombre: string;
}

// Las claves dan acceso a los datos de la empresa: las gestiona solo su admin.
@ApiTags('api-keys')
@Roles(RolUsuario.admin_tenant, RolUsuario.super_admin)
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly keys: ApiKeysService) {}

  @Get()
  listar(@CurrentUser('tenantId') tenantId: string) {
    return this.keys.listar(tenantId);
  }

  @Post()
  crear(@CurrentUser('tenantId') tenantId: string, @CurrentUser('userId') userId: string, @Body() dto: CreateApiKeyDto) {
    return this.keys.crear(tenantId, userId ?? null, dto.nombre);
  }

  @Delete(':id')
  revocar(@CurrentUser('tenantId') tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.keys.revocar(tenantId, id);
  }
}
