import { IsEnum, IsUUID } from 'class-validator';
import { TipoDocumento } from '@prisma/client';

export class CreateDocumentDto {
  @IsUUID()
  shipmentId: string;

  @IsEnum(TipoDocumento)
  tipo: TipoDocumento;
}
