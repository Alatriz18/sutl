import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ModoTransporte, TipoEnvio } from '@prisma/client';

export class CreateBookingDto {
  @IsOptional()
  @IsUUID()
  quoteId?: string;

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
  @IsDateString()
  fechaEstimadaCarga?: string;
}
