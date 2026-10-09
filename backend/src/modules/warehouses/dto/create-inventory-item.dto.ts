import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator';

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

  @IsInt()
  @Min(0)
  cantidad: number;

  @IsOptional()
  @IsString()
  unidad?: string;
}
