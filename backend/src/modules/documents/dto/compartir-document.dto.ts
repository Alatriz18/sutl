import { IsBoolean, IsOptional } from 'class-validator';

export class CompartirDocumentDto {
  @IsOptional()
  @IsBoolean()
  visibleCliente?: boolean;

  @IsOptional()
  @IsBoolean()
  visibleProveedor?: boolean;
}
