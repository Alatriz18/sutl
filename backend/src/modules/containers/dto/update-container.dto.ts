import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { EstadoContenedor } from '@prisma/client';
import { CreateContainerDto } from './create-container.dto';

export class UpdateContainerDto extends PartialType(CreateContainerDto) {
  @IsOptional()
  @IsEnum(EstadoContenedor)
  estado?: EstadoContenedor;
}
