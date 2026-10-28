import { IsDateString, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export const ESTADOS_TRANSICION = ['emitida', 'confirmada', 'despachada', 'cancelada'] as const;
export type EstadoTransicion = (typeof ESTADOS_TRANSICION)[number];

// recibida_parcial / recibida no se fijan a mano: salen de registrar recepciones.
export class TransitionPurchaseOrderDto {
  @IsIn(ESTADOS_TRANSICION)
  estado: EstadoTransicion;

  @IsOptional()
  @IsDateString()
  fechaConfirmadaProveedor?: string;

  @IsOptional()
  @IsDateString()
  fechaDespacho?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  motivo?: string;
}
