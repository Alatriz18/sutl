import { EstadoOrdenCompra } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class QueryPurchaseOrdersDto {
  @IsOptional()
  @IsEnum(EstadoOrdenCompra)
  estado?: EstadoOrdenCompra;

  @IsOptional()
  @IsUUID()
  proveedorId?: string;

  // Busca por número de OC o SKU de alguna de sus líneas.
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;
}
