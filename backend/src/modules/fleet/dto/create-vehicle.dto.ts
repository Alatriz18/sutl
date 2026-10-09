import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateVehicleDto {
  @IsString()
  @IsNotEmpty()
  placa: string;

  @IsString()
  @IsNotEmpty()
  tipo: string;

  @IsOptional()
  @IsNumber()
  capacidadKg?: number;
}
