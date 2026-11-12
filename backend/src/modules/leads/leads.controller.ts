import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { RolUsuario } from '@prisma/client';
import { limiteLeads } from '../../common/rate-limit';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateLeadDto } from './dto/create-lead.dto';
import { LeadsService } from './leads.service';

@ApiTags('leads')
@Controller('leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  // Público (formulario de la landing). Límite estricto por IP: 5 por hora.
  @Public()
  @Throttle({ default: { limit: limiteLeads, ttl: 3_600_000 } })
  @HttpCode(HttpStatus.CREATED)
  @Post()
  async crear(@Body() dto: CreateLeadDto) {
    await this.leads.registrar(dto);
    return { ok: true };
  }

  // Los contactos son de SVK Solutions, no de una empresa-cliente: solo super_admin.
  @Roles(RolUsuario.super_admin)
  @Get()
  listar() {
    return this.leads.listar();
  }
}
