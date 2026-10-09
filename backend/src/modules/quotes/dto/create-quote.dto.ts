import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ModoTransporte, TipoEnvio } from '@prisma/client';

export class CreateQuoteDto {
  @IsUUID()
  clienteId: string;

  @IsEnum(TipoEnvio)
  tipo: TipoEnvio;

  @IsEnum(ModoTransporte)
  modo: ModoTransporte;

  @IsOptional()
  @IsUUID()
  carrierId?: string;

  @IsString()
  @IsNotEmpty()
  origen: string;

  @IsString()
  @IsNotEmpty()
  destino: string;

  @IsOptional()
  @IsNumber()
  pesoKg?: number;

  @IsOptional()
  @IsNumber()
  volumenM3?: number;

  @IsOptional()
  @IsNumber()
  tarifaEstimada?: number;

  @IsOptional()
  @IsString()
  moneda?: string;

  @IsOptional()
  @IsDateString()
  validoHasta?: string;

  @IsOptional()
  @IsString()
  notas?: string;
}
