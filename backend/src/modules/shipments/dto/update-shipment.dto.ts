import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { EstadoEnvio } from '@prisma/client';
import { CreateShipmentDto } from './create-shipment.dto';

export class UpdateShipmentDto extends PartialType(CreateShipmentDto) {
  @IsOptional()
  @IsEnum(EstadoEnvio)
  estado?: EstadoEnvio;
}
