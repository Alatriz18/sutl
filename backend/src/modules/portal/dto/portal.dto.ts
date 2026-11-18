import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsEnum, IsIn, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import { ModoTransporte } from '@prisma/client';

export const ENTIDADES_PORTAL = ['orden_compra', 'envio'] as const;

export class QueryMensajesDto {
  @IsIn(ENTIDADES_PORTAL)
  entidadTipo: (typeof ENTIDADES_PORTAL)[number];

  @IsUUID()
  entidadId: string;
}

export class CreateMensajeDto extends QueryMensajesDto {
  @IsString()
  @MaxLength(2000)
  texto: string;
}

export class ConfirmarOrdenDto {
  // Fecha en que el proveedor se compromete a despachar.
  @IsDateString()
  fechaConfirmada: string;
}

export class DespacharLineaDto {
  @IsUUID()
  lineaId: string;

  // Cantidad que sale en este despacho (mayor que cero).
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  cantidad: number;
}

// El proveedor avisa que su carga ya salió: se crea el embarque y se le asigna lo despachado.
export class DespacharOrdenDto {
  @IsEnum(ModoTransporte)
  modo: ModoTransporte;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  origen: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  destino: string;

  // Número de guía, BL o AWB que le dio su transportista (opcional).
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  referenciaDocumento?: string;

  // Día en que la carga salió realmente.
  @IsDateString()
  fechaDespacho: string;

  @IsOptional()
  @IsDateString()
  fechaEstimadaLlegada?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  pesoKg?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => DespacharLineaDto)
  lineas: DespacharLineaDto[];
}
