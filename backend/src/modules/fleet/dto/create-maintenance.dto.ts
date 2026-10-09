import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateMaintenanceDto {
  @IsString()
  @IsNotEmpty()
  tipo: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsNumber()
  costo?: number;
}
