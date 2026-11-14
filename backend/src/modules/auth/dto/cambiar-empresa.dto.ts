import { IsUUID } from 'class-validator';

export class CambiarEmpresaDto {
  @IsUUID()
  tenantId: string;
}
