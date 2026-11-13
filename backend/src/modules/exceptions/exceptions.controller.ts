import { Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { EstadoExcepcion } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ExceptionsService } from './exceptions.service';

class ListExcepcionesQuery {
  @IsOptional()
  @IsEnum(EstadoExcepcion)
  estado?: EstadoExcepcion;
}

// Gestión interna de la empresa: el cliente_final no tiene acceso.
@ApiTags('exceptions')
@Roles(RolUsuario.admin_tenant, RolUsuario.operador, RolUsuario.super_admin)
@Controller('exceptions')
export class ExceptionsController {
  constructor(private readonly exceptions: ExceptionsService) {}

  @Get()
  list(@CurrentUser('tenantId') tenantId: string, @Query() q: ListExcepcionesQuery) {
    return this.exceptions.list(tenantId, q.estado);
  }

  // Evalúa ahora, sin esperar la ronda programada.
  @Post('evaluar')
  evaluar(@CurrentUser('tenantId') tenantId: string) {
    return this.exceptions.evaluarEmpresa(tenantId);
  }
}
