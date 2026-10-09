import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateLocationDto {
  @IsString()
  @IsNotEmpty()
  codigo: string;

  @IsOptional()
  @IsString()
  tipo?: string;

  @IsOptional()
  @IsNumber()
  capacidad?: number;
}
