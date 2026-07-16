import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { EstadoEnvio } from '@prisma/client';

export class CreateTrackingEventDto {
  @IsString()
  @IsNotEmpty()
  shipmentId: string;

  @IsEnum(EstadoEnvio)
  estado: EstadoEnvio;

  @IsOptional()
  @IsString()
  ubicacion?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;
}
