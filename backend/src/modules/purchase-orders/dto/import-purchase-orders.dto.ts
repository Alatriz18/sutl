import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Min,
  MaxLength,
} from 'class-validator';
import { INCOTERMS } from './create-purchase-order.dto';

// Una fila del archivo = una línea de OC. Las filas con el mismo N° de OC
// forman una sola orden; los datos de cabecera (proveedor, fechas…) se leen de
// la primera fila y las demás pueden repetirlos u omitirlos.
export class ImportPurchaseOrderRowDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  numero: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  proveedor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  proveedorTaxId?: string;

  @IsOptional()
  @IsIn(INCOTERMS)
  incoterm?: string;

  @IsOptional()
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
  @IsNumber()
  @Min(0)
  precioUnitario?: number;
}

export class ImportPurchaseOrdersDto {
  // Cada fila se valida contra ImportPurchaseOrderRowDto en el servicio, para
  // informar los errores fila por fila en vez de rechazar todo el archivo.
  @IsArray()
  @ArrayMaxSize(5000)
  @IsObject({ each: true })
  filas: Record<string, unknown>[];

  // true = solo valida y muestra qué pasaría, sin guardar nada.
  @IsOptional()
  @IsBoolean()
  simular?: boolean;

  // true = los proveedores que no existan se crean con el nombre del archivo.
  @IsOptional()
  @IsBoolean()
  crearProveedores?: boolean;
}
