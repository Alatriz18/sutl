import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { ModoTransporte, TipoEnvio } from '@prisma/client';

export class CreateRateDto {
  @IsUUID()
  carrierId: string;

  @IsString()
  @IsNotEmpty()
  origen: string;

  @IsString()
  @IsNotEmpty()
  destino: string;

  @IsEnum(ModoTransporte)
  modo: ModoTransporte;

  @IsEnum(TipoEnvio)
  tipo: TipoEnvio;

  @IsString()
  @IsNotEmpty()
  unidad: string;

  @IsNumber()
  precioBase: number;

  @IsOptional()
  @IsString()
  moneda?: string;

  @IsOptional()
  @IsDateString()
  vigenteDesde?: string;

  @IsOptional()
  @IsDateString()
  vigenteHasta?: string;
}
