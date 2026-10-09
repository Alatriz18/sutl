import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
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
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';

const TIPOS_PERMITIDOS = ['.pdf', '.jpg', '.jpeg', '.png', '.xlsx', '.doc', '.docx'];

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  findAll(@CurrentUser('tenantId') tenantId: string) {
    return this.documentsService.findAll(tenantId);
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          // req.user ya está disponible acá porque JwtAuthGuard corre antes del interceptor.
          const tenantId = (req as any).user?.tenantId ?? 'sin-tenant';
          const dir = `uploads/${tenantId}`;
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          cb(null, `${randomUUID()}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
      fileFilter: (_req, file, cb) => {
        if (!TIPOS_PERMITIDOS.includes(extname(file.originalname).toLowerCase())) {
          cb(new BadRequestException('Tipo de archivo no permitido'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
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
  @Get(':id/download')
  async download(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const document = await this.documentsService.findOne(tenantId, id);
    const rutaAbsoluta = join(process.cwd(), document.urlArchivo);
    res.download(rutaAbsoluta, document.nombreArchivo);
  }
}
