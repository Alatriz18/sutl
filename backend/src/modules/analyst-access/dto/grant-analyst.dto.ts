import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class GrantAnalystDto {
  @IsUUID()
  analystId: string;

  // La empresa cliente a la que se da acceso.
  @IsUUID()
  tenantId: string;

  // Por defecto solo lectura: el acceso de escritura se concede a propósito.
  @IsOptional()
  @IsBoolean()
  soloLectura?: boolean;
}
