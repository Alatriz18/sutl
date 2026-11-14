import { IsDateString, IsIn, IsString, IsUUID, MaxLength } from 'class-validator';

export const ENTIDADES_PORTAL = ['orden_compra', 'envio'] as const;

export class QueryMensajesDto {
  @IsIn(ENTIDADES_PORTAL)
  entidadTipo: (typeof ENTIDADES_PORTAL)[number];

  @IsUUID()
  entidadId: string;
}

export class CreateMensajeDto extends QueryMensajesDto {
  @IsString()
  @MaxLength(2000)
  texto: string;
}

export class ConfirmarOrdenDto {
  // Fecha en que el proveedor se compromete a despachar.
  @IsDateString()
  fechaConfirmada: string;
}
