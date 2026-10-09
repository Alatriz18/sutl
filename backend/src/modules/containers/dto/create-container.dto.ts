import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateContainerDto {
  @IsString()
  @IsNotEmpty()
  numeroContenedor: string;

  @IsOptional()
  @IsString()
  tipo?: string;

  @IsOptional()
  @IsUUID()
  carrierId?: string;

  @IsString()
  @IsNotEmpty()
  origen: string;

  @IsString()
  @IsNotEmpty()
  destino: string;

  @IsOptional()
  @IsNumber()
  capacidadM3?: number;
}
