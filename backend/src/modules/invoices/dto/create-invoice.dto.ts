import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { TipoFactura } from '@prisma/client';

export class CreateInvoiceDto {
  @IsEnum(TipoFactura)
  tipo: TipoFactura;

  @IsUUID()
  partnerId: string;

  @IsOptional()
  @IsUUID()
  shipmentId?: string;

  @IsNumber()
  montoTotal: number;

  @IsOptional()
  @IsString()
  moneda?: string;

  @IsOptional()
  @IsDateString()
  fechaVencimiento?: string;
}
