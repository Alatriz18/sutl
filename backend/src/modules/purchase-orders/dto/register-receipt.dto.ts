import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsBoolean,
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class ReceiptLineDto {
  @IsUUID()
  lineaId: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  cantidad: number;
}

export class RegisterReceiptDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ReceiptLineDto)
  lineas: ReceiptLineDto[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notas?: string;

  // Bodega a la que entra lo recibido. Obligatoria cuando la recepción mueve
  // inventario (según la configuración del tenant).
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  // Solo aplica con la configuración "a_eleccion": quien recibe decide.
  @IsOptional()
  @IsBoolean()
  actualizarInventario?: boolean;
}
