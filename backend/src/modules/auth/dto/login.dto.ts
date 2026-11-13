import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;

  // Código de la app de autenticación (o de recuperación) si la cuenta tiene segundo factor.
  @IsOptional()
  @IsString()
  @MaxLength(20)
  codigo?: string;
}
