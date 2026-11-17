import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
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
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;
}
