import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { EstadoVehiculo } from '@prisma/client';
import { CreateVehicleDto } from './create-vehicle.dto';

export class UpdateVehicleDto extends PartialType(CreateVehicleDto) {
  @IsOptional()
  @IsEnum(EstadoVehiculo)
  estado?: EstadoVehiculo;
}
