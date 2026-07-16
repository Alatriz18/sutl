import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsOptional()
  @IsString()
  ruc?: string;

  @IsOptional()
  @IsString()
  plan?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
