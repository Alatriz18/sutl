import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreatePaymentDto {
  @IsNumber()
  monto: number;

  @IsOptional()
  @IsString()
  metodo?: string;

  @IsOptional()
  @IsString()
  referencia?: string;
}
