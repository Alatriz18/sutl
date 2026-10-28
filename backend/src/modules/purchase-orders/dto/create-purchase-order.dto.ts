import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

// Incoterms 2020 — define quién paga y asume el riesgo en cada tramo.
export const INCOTERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'] as const;

export class PurchaseOrderLineDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  sku: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  descripcion: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  cantidad: number;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  unidad?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  precioUnitario?: number;
}

export class CreatePurchaseOrderDto {
  // Número de OC tal como existe en el ERP del cliente.
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  numero: string;

  @IsUUID()
  proveedorId: string;

  @IsOptional()
  @IsIn(INCOTERMS)
  incoterm?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  moneda?: string;

  @IsOptional()
  @IsDateString()
  fechaEmision?: string;

  @IsOptional()
  @IsDateString()
  fechaRequerida?: string;

  @IsOptional()
  @IsDateString()
  fechaConfirmadaProveedor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notas?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderLineDto)
  lineas: PurchaseOrderLineDto[];
}
