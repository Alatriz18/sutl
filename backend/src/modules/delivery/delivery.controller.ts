import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Post, Res, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';
import { randomUUID } from 'crypto';
import { Response } from 'express';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequestUser } from '../../common/interfaces/jwt-payload.interface';
import { DeliveryService } from './delivery.service';
import { RegisterPodDto } from './dto/register-pod.dto';

// Evidencia: fotos y PDF. Nada ejecutable ni office.
const TIPOS_EVIDENCIA = ['.pdf', '.jpg', '.jpeg', '.png'];

// La prueba de entrega la registra el equipo; la consulta también el cliente final, solo de sus envíos.
@ApiTags('delivery')
@Controller('shipments/:shipmentId/pod')
export class DeliveryController {
  constructor(private readonly delivery: DeliveryService) {}

  @Get()
  @Roles(RolUsuario.admin_tenant, RolUsuario.operador, RolUsuario.super_admin, RolUsuario.cliente_final)
  obtener(@CurrentUser() user: RequestUser, @Param('shipmentId', ParseUUIDPipe) shipmentId: string) {
    return this.delivery.obtener(user, shipmentId);
  }

  // Descarga protegida: se valida el envío antes de servir el archivo; el disco nunca se expone.
  @Get('evidencia')
  @Roles(RolUsuario.admin_tenant, RolUsuario.operador, RolUsuario.super_admin, RolUsuario.cliente_final)
  async evidencia(@CurrentUser() user: RequestUser, @Param('shipmentId', ParseUUIDPipe) shipmentId: string, @Res() res: Response) {
    const { ruta, nombre } = await this.delivery.archivo(user, shipmentId);
    res.download(join(process.cwd(), ruta), nombre);
  }

  // Firma en pantalla de quien recibió (imagen PNG).
  @Get('firma')
  @Roles(RolUsuario.admin_tenant, RolUsuario.operador, RolUsuario.super_admin, RolUsuario.cliente_final)
  async firma(@CurrentUser() user: RequestUser, @Param('shipmentId', ParseUUIDPipe) shipmentId: string, @Res() res: Response) {
    const { ruta } = await this.delivery.firma(user, shipmentId);
    res.type('image/png').sendFile(join(process.cwd(), ruta));
  }

  @Post()
  @Roles(RolUsuario.admin_tenant, RolUsuario.operador, RolUsuario.super_admin)
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'evidencia', maxCount: 1 }, { name: 'firma', maxCount: 1 }], {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const tenantId = (req as { user?: { tenantId?: string } }).user?.tenantId ?? 'sin-tenant';
          const dir = `uploads/${tenantId}`;
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => cb(null, `pod-${randomUUID()}${extname(file.originalname).toLowerCase()}`),
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        // La firma es solo un PNG (el servidor además comprueba su contenido).
        if (file.fieldname === 'firma' && extname(file.originalname).toLowerCase() !== '.png') {
          cb(new BadRequestException('La firma debe ser una imagen PNG'), false);
          return;
        }
        if (!TIPOS_EVIDENCIA.includes(extname(file.originalname).toLowerCase())) {
          cb(new BadRequestException('La evidencia debe ser una foto (JPG o PNG) o un PDF'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  registrar(
    @CurrentUser() user: RequestUser,
    @Param('shipmentId', ParseUUIDPipe) shipmentId: string,
    @Body() dto: RegisterPodDto,
    @UploadedFiles() archivos?: { evidencia?: Express.Multer.File[]; firma?: Express.Multer.File[] },
  ) {
    return this.delivery.registrar(user, shipmentId, dto, archivos?.evidencia?.[0], archivos?.firma?.[0]);
  }
}
