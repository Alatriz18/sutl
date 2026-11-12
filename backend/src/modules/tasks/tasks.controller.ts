import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequestUser } from '../../common/interfaces/jwt-payload.interface';
import { CreateCommentDto, CreateTaskDto, ListTasksQueryDto, UpdateTaskDto } from './dto/task.dto';
import { TasksService } from './tasks.service';

// Trabajo interno de la empresa: el cliente_final no tiene acceso.
@ApiTags('tasks')
@Roles(RolUsuario.admin_tenant, RolUsuario.operador, RolUsuario.super_admin)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  findAll(@CurrentUser() user: RequestUser, @Query() q: ListTasksQueryDto) {
    return this.tasks.findAll(user, q);
  }

  @Get(':id')
  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.tasks.findOne(tenantId, id);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateTaskDto) {
    return this.tasks.create(user, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTaskDto) {
    return this.tasks.update(user, id, dto);
  }

  @Post(':id/comments')
  comentar(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateCommentDto) {
    return this.tasks.comentar(user, id, dto);
  }
}
