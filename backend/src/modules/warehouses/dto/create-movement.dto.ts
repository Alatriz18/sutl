import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { TipoMovimientoInventario } from '@prisma/client';

export class CreateMovementDto {
  @IsEnum(TipoMovimientoInventario)
  tipo: TipoMovimientoInventario;

  @IsInt()
  @Min(1)
  cantidad: number;

  @IsOptional()
  @IsString()
  notas?: string;
}
