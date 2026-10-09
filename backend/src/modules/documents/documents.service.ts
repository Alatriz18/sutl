import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDocumentDto } from './dto/create-document.dto';

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(tenantId: string) {
    return this.prisma.document.findMany({
      where: { tenantId },
      include: { shipment: true, subidoPor: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const document = await this.prisma.document.findFirst({ where: { id, tenantId } });
    if (!document) {
      throw new NotFoundException('Documento no encontrado');
    }
    return document;
  }

  async create(
    tenantId: string,
    userId: string,
    dto: CreateDocumentDto,
    file: Express.Multer.File,
  ) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id: dto.shipmentId, tenantId },
    });
    if (!shipment) {
      throw new NotFoundException('Envío no encontrado para este tenant');
    }

    // Si ya existe un documento del mismo tipo para este envío, la nueva
    // carga se registra como la siguiente versión (no se pisa el archivo).
    const anterior = await this.prisma.document.findFirst({
      where: { tenantId, shipmentId: dto.shipmentId, tipo: dto.tipo },
      orderBy: { version: 'desc' },
    });

    return this.prisma.document.create({
      data: {
        tenantId,
        shipmentId: dto.shipmentId,
        tipo: dto.tipo,
        nombreArchivo: file.originalname,
        urlArchivo: `/uploads/${tenantId}/${file.filename}`,
        version: anterior ? anterior.version + 1 : 1,
        subidoPorId: userId,
      },
      include: { shipment: true, subidoPor: true },
    });
  }
}
