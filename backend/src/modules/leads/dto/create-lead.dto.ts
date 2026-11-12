import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateLeadDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nombre: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  empresa: string;

  @IsEmail()
  @MaxLength(160)
  email: string;

  @IsOptional()
  @IsString()
  @Matches(/^[+\d][\d\s().-]{6,24}$/, { message: 'El teléfono no es válido' })
  telefono?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  mensaje?: string;

  // Campo trampa para bots (oculto en la página): si viene lleno, se descarta en silencio.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  sitioWeb?: string;
}
