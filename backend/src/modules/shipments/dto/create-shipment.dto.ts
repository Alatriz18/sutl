import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ModoTransporte, TipoEnvio } from '@prisma/client';

export class CreateShipmentDto {
  @IsEnum(TipoEnvio)
  tipo: TipoEnvio;

  @IsEnum(ModoTransporte)
  modo: ModoTransporte;

  @IsOptional()
  @IsUUID()
  carrierId?: string;

  @IsOptional()
  @IsString()
  referenciaDocumento?: string;

  @IsString()
  @IsNotEmpty()
  remitenteNombre: string;

  @IsString()
  @IsNotEmpty()
  destinatarioNombre: string;

  @IsOptional()
  @IsEmail()
  destinatarioEmail?: string;

  @IsString()
  @IsNotEmpty()
  origen: string;

  @IsString()
  @IsNotEmpty()
  destino: string;

  @IsOptional()
  @IsString()
  puertoOrigen?: string;

  @IsOptional()
  @IsString()
  puertoDestino?: string;

  @IsOptional()
  @IsNumber()
  pesoKg?: number;

  @IsOptional()
  @IsDateString()
  fechaEstimadaSalida?: string;

  @IsOptional()
  @IsDateString()
  fechaEstimadaLlegada?: string;
}
