import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CodigoMfaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  codigo: string;
}

export class DesactivarMfaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  password: string;

  // Código vigente de la app, o uno de recuperación.
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  codigo: string;
}
