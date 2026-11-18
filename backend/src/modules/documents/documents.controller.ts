import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/jwt-payload.interface';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolUsuario } from '@prisma/client';
import { DocumentsService } from './documents.service';
import { RevisarDocumentDto } from './dto/revisar-document.dto';
import { CreateDocumentDto, SubirExternoDto } from './dto/create-document.dto';
import { CompartirDocumentDto } from './dto/compartir-document.dto';
import { SharedDocumentsService } from './shared-documents.service';
import { ApiTags } from '@nestjs/swagger';

const TIPOS_PERMITIDOS = ['.pdf', '.jpg', '.jpeg', '.png', '.xlsx', '.doc', '.docx'];

// Cómo se guardan los archivos subidos: en una carpeta por empresa, con nombre aleatorio y solo tipos permitidos.
function opcionesArchivo() {
  return {
    storage: diskStorage({
      destination: (req, _file, cb) => {
        // req.user ya está disponible acá porque JwtAuthGuard corre antes del interceptor.
        const tenantId = (req as any).user?.tenantId ?? 'sin-tenant';
        const dir = `uploads/${tenantId}`;
        mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (_req: unknown, file: Express.Multer.File, cb: (e: Error | null, name: string) => void) => {
        cb(null, `${randomUUID()}${extname(file.originalname)}`);
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter: (_req: unknown, file: Express.Multer.File, cb: (e: Error | null, ok: boolean) => void) => {
      if (!TIPOS_PERMITIDOS.includes(extname(file.originalname).toLowerCase())) {
        cb(new BadRequestException('Tipo de archivo no permitido'), false);
        return;
      }
      cb(null, true);
    },
  };
}

@ApiTags('documents')
@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly shared: SharedDocumentsService,
  ) {}

  // Listado interno de la empresa (el cliente final y el proveedor usan el de cada envío).
  @Get()
  @Roles(RolUsuario.admin_tenant, RolUsuario.operador, RolUsuario.super_admin)
  findAll(@CurrentUser('tenantId') tenantId: string) {
    return this.documentsService.findAll(tenantId);
  }

  // Documentos de un envío: el equipo los ve todos (con con quién se comparten); el cliente final y el proveedor,
  // solo los compartidos con ellos en SUS envíos.
  @Get('shipment/:shipmentId')
  @Roles(RolUsuario.admin_tenant, RolUsuario.operador, RolUsuario.super_admin, RolUsuario.cliente_final, RolUsuario.proveedor)
  listarDeEnvio(@CurrentUser() user: RequestUser, @Param('shipmentId', ParseUUIDPipe) shipmentId: string) {
    return this.shared.listar(user, shipmentId);
  }

  // El equipo decide con quién se comparte un documento.
  @Patch(':id/compartir')
  @Roles(RolUsuario.admin_tenant, RolUsuario.operador, RolUsuario.super_admin)
  compartir(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CompartirDocumentDto) {
    return this.shared.compartir(user, id, dto);
  }

  // Un externo (proveedor o cliente final) sube un documento a un envío suyo.
  @Post('shipment/:shipmentId/externo')
  @Roles(RolUsuario.cliente_final, RolUsuario.proveedor)
  @UseInterceptors(FileInterceptor('file', opcionesArchivo()))
  subirExterno(
    @CurrentUser() user: RequestUser,
    @Param('shipmentId', ParseUUIDPipe) shipmentId: string,
    @Body() dto: SubirExternoDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Debes adjuntar un archivo');
    return this.shared.subirExterno(user, shipmentId, dto.tipo, dto.fechaVencimiento, file);
  }

  // Checklist de documentos exigidos para un envío (según la configuración de la empresa).
  @Get('checklist/:shipmentId')
  @Roles(RolUsuario.admin_tenant, RolUsuario.operador, RolUsuario.super_admin)
  checklist(@CurrentUser('tenantId') tenantId: string, @Param('shipmentId', ParseUUIDPipe) shipmentId: string) {
    return this.documentsService.checklist(tenantId, shipmentId);
  }

  // Aprobar o rechazar la versión vigente de un documento.
  @Patch(':id/revision')
  @Roles(RolUsuario.admin_tenant, RolUsuario.operador, RolUsuario.super_admin)
  revisar(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevisarDocumentDto,
  ) {
    return this.documentsService.revisar(tenantId, userId, id, dto);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', opcionesArchivo()))
  create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateDocumentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Debes adjuntar un archivo');
    }
    return this.documentsService.create(tenantId, userId, dto, file);
  }

  // Descarga protegida: valida que el documento pertenezca al tenant antes
  // de servir el archivo — el disco (uploads/) nunca se expone públicamente.
  // Un externo solo descarga lo que se compartió con él en un envío suyo.
  @Get(':id/download')
  @Roles(RolUsuario.admin_tenant, RolUsuario.operador, RolUsuario.super_admin, RolUsuario.cliente_final, RolUsuario.proveedor)
  async download(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const document = await this.shared.paraDescarga(user, id);
    const rutaAbsoluta = join(process.cwd(), document.urlArchivo);
    res.download(rutaAbsoluta, document.nombreArchivo);
  }
}
