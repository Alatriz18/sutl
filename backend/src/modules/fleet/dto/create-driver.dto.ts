import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateDriverDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsNotEmpty()
  licencia: string;

  @IsOptional()
  @IsString()
  telefono?: string;
}
