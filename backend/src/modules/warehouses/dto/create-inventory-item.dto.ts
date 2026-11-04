import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateInventoryItemDto {
  @IsUUID()
  warehouseId: string;

  @IsOptional()
  @IsUUID()
  ubicacionId?: string;

  @IsOptional()
  @IsUUID()
  shipmentId?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsString()
  @IsNotEmpty()
  descripcion: string;

  // Decimales para unidades como kg, m3 o litros.
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  cantidad: number;

  @IsOptional()
  @IsString()
  unidad?: string;
}
