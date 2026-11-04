import { IsEnum, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { TipoMovimientoInventario } from '@prisma/client';

export class CreateMovementDto {
  @IsEnum(TipoMovimientoInventario)
  tipo: TipoMovimientoInventario;

  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  cantidad: number;

  @IsOptional()
  @IsString()
  notas?: string;
}
