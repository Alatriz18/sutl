import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class LinkShipmentLineDto {
  @IsUUID()
  lineaId: string;

  // Cantidad de la línea que viaja en este embarque. 0 quita la línea del embarque.
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  cantidad: number;
}

export class LinkShipmentDto {
  @IsUUID()
  shipmentId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => LinkShipmentLineDto)
  lineas: LinkShipmentLineDto[];
}
