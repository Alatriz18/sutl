import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpsertInventoryPolicyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  sku: string;

  // Unidades que se consumen por día (en la misma unidad del SKU).
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  consumoDiario: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  stockSeguridad?: number;

  // Días que tarda el proveedor en reponer; lo usará el motor de riesgo.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  leadTimeDias?: number;

  // Existencias que reporta el ERP/WMS del cliente. Solo se aceptan cuando la
  // empresa configuró que el inventario vive en otro sistema.
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  existenciasExternas?: number;
}

export class ImportInventoryPoliciesDto {
  // Cada fila se valida contra UpsertInventoryPolicyDto en el servicio, para
  // informar los errores fila por fila en vez de rechazar todo el lote.
  @IsArray()
  @ArrayMaxSize(5000)
  @IsObject({ each: true })
  filas: Record<string, unknown>[];

  // true = solo valida y muestra qué pasaría, sin guardar nada.
  @IsOptional()
  @IsBoolean()
  simular?: boolean;
}
