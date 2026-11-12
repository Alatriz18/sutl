import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class AuditQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  entidad?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  entidadId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limite?: number;
}
