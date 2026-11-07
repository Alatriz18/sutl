import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { QueuesService } from './queues.service';

// Estado de las colas: dato de infraestructura de toda la plataforma, no de una
// empresa. Por eso solo lo ve el super_admin.
@UseGuards(RolesGuard)
@Roles(RolUsuario.super_admin)
@ApiTags('queues')
@Controller('queues')
export class QueuesController {
  constructor(private readonly queues: QueuesService) {}

  @Get('estado')
  estado() {
    return this.queues.estado();
  }
}
