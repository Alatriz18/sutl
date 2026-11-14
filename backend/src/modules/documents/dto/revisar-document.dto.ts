import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class RevisarDocumentDto {
  @IsIn(['aprobado', 'rechazado'])
  estado: 'aprobado' | 'rechazado';

  // Obligatorio al rechazar: quien subió el archivo necesita saber qué corregir.
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivoRechazo?: string;
}
