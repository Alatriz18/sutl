import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequestUser } from '../../common/interfaces/jwt-payload.interface';
import { CreateCommentDto, CreateTaskDto, ListTasksQueryDto, UpdateTaskDto } from './dto/task.dto';
import { TasksService } from './tasks.service';

const TIPOS_EVIDENCIA = ['.pdf', '.jpg', '.jpeg', '.png', '.xlsx', '.doc', '.docx'];

// La evidencia se guarda en la carpeta de la empresa, con nombre aleatorio, solo de tipos permitidos y hasta 10 MB.
const opcionesEvidencia = {
  storage: diskStorage({
    destination: (req, _file, cb) => {
      const dir = `uploads/${(req as unknown as { user?: { tenantId?: string } }).user?.tenantId ?? 'sin-tenant'}`;
      mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req: unknown, file: Express.Multer.File, cb: (e: Error | null, name: string) => void) => cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (e: Error | null, ok: boolean) => void) => {
    if (!TIPOS_EVIDENCIA.includes(extname(file.originalname).toLowerCase())) return cb(new BadRequestException('Tipo de archivo no permitido'), false);
    cb(null, true);
  },
};

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

  @Post(':id/adjuntos')
  @UseInterceptors(FileInterceptor('file', opcionesEvidencia))
  adjuntar(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Debes adjuntar un archivo');
    return this.tasks.adjuntar(user, id, file);
  }

  // Descarga protegida: valida empresa y tarea antes de servir el archivo (el disco nunca se expone).
  @Get(':id/adjuntos/:adjuntoId/download')
  async descargar(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('adjuntoId', ParseUUIDPipe) adjuntoId: string,
    @Res() res: Response,
  ) {
    const a = await this.tasks.adjuntoParaDescarga(tenantId, id, adjuntoId);
    res.download(join(process.cwd(), a.urlArchivo), a.nombreArchivo);
  }
}
