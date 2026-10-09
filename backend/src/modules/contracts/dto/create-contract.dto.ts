import { IsDateString, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateContractDto {
  @IsUUID()
  carrierId: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsOptional()
  @IsString()
  numeroContrato?: string;

  @IsDateString()
  vigenteDesde: string;

  @IsOptional()
  @IsDateString()
  vigenteHasta?: string;

  @IsOptional()
  @IsObject()
  condiciones?: Record<string, unknown>;
}
