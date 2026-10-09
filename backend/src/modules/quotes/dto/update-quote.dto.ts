import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { EstadoCotizacion } from '@prisma/client';
import { CreateQuoteDto } from './create-quote.dto';

export class UpdateQuoteDto extends PartialType(CreateQuoteDto) {
  @IsOptional()
  @IsEnum(EstadoCotizacion)
  estado?: EstadoCotizacion;
}
