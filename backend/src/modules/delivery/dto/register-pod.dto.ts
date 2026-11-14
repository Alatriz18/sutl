import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

// Llega como multipart: los booleanos vienen como texto.
const aBooleano = ({ value }: { value: unknown }) => (value === 'true' || value === true ? true : value === 'false' || value === false ? false : value);

export class RegisterPodDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  receptorNombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  receptorDocumento?: string;

  // Momento real de la entrega; por defecto, ahora.
  @IsOptional()
  @IsDateString()
  entregadoAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observaciones?: string;

  // Recibir en las órdenes de compra la carga que viajaba en este envío.
  @IsOptional()
  @Transform(aBooleano)
  @IsBoolean()
  recibirOc?: boolean;

  // Mismas reglas de inventario que una recepción normal (según la configuración de la empresa).
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @Transform(aBooleano)
  @IsBoolean()
  actualizarInventario?: boolean;
}
