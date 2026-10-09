import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class CreateReportDto {
  @IsString()
  @IsNotEmpty()
  tipo: string;

  @IsIn(['pdf', 'excel', 'csv'])
  formato: string;
}
