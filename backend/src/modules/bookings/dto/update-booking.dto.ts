import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { EstadoReserva } from '@prisma/client';
import { CreateBookingDto } from './create-booking.dto';

export class UpdateBookingDto extends PartialType(CreateBookingDto) {
  @IsOptional()
  @IsEnum(EstadoReserva)
  estado?: EstadoReserva;
}
