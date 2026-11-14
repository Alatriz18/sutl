import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { TipoDocumento } from '@prisma/client';

export class CreateDocumentDto {
  @IsUUID()
  shipmentId: string;

  @IsEnum(TipoDocumento)
  tipo: TipoDocumento;

  // Para certificados y permisos que caducan (llega como texto en multipart).
  @IsOptional()
  @IsDateString()
  fechaVencimiento?: string;
}
