import { IsEnum, IsObject, IsOptional, IsUUID } from 'class-validator';
import { TipoAlerta } from '@prisma/client';

export class CreateAlertDto {
  @IsEnum(TipoAlerta)
  tipo: TipoAlerta;

  @IsOptional()
  @IsUUID()
  shipmentId?: string;

  // Forma según `tipo`:
  // retraso              -> { estado: EstadoEnvio, diasUmbral: number }
  // documento_faltante   -> { tipoDocumento: TipoDocumento, diasUmbral: number }
  // llegada_proxima      -> { diasAntes: number }
  // cambio_estado / personalizada -> libre (no se evalúa automáticamente)
  @IsObject()
  condicion: Record<string, unknown>;
}
