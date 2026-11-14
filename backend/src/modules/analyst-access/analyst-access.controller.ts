import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';
import { IsOptional, IsUUID } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AnalystAccessService } from './analyst-access.service';
import { GrantAnalystDto } from './dto/grant-analyst.dto';

class ListGrantsQuery {
  @IsOptional()
  @IsUUID()
  analystId?: string;

  @IsOptional()
  @IsUUID()
  tenantId?: string;
}

// Gestión de permisos de los analistas de SUTL: solo el super_admin.
@ApiTags('analyst-grants')
@Roles(RolUsuario.super_admin)
@Controller('analyst-grants')
export class AnalystAccessController {
  constructor(private readonly access: AnalystAccessService) {}

  @Get()
  listar(@Query() q: ListGrantsQuery) {
    return this.access.listar(q);
  }

  @Post()
  otorgar(@CurrentUser('userId') actorId: string, @Body() dto: GrantAnalystDto) {
    return this.access.otorgar(actorId, dto);
  }

  @Delete(':id')
  revocar(@CurrentUser('userId') actorId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.access.revocar(actorId, id);
  }
}
