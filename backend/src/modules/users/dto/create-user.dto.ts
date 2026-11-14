import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { RolUsuario } from '@prisma/client';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsOptional()
  @IsEnum(RolUsuario)
  rol?: RolUsuario;

  // Solo para el rol proveedor: el proveedor (de la lista de la empresa) al que representa.
  @IsOptional()
  @IsUUID()
  partnerId?: string;
}
