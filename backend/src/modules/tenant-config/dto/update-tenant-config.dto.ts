import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { MODOS_RECEPCION_INVENTARIO, ModoRecepcionInventario, PERFIL_IDS, PerfilId } from '../tenant-config.defaults';

export class ComprasConfigDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(50)
  toleranciaSobreRecepcionPct?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  diasAlertaAnticipada?: number;

  @IsOptional()
  @IsBoolean()
  exigirFechaConfirmacion?: boolean;

  @IsOptional()
  @IsBoolean()
  vincularEmbarqueDespachaOc?: boolean;
}

export class InventarioConfigDto {
  @IsOptional()
  @IsIn(MODOS_RECEPCION_INVENTARIO)
  recepcionActualizaInventario?: ModoRecepcionInventario;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  diasCoberturaAlerta?: number;
}

export class RiesgoConfigDto {
  @IsOptional()
  @IsBoolean()
  avisarAlPasarARojo?: boolean;
}

export class ConfiguracionDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ComprasConfigDto)
  compras?: ComprasConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => InventarioConfigDto)
  inventario?: InventarioConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => RiesgoConfigDto)
  riesgo?: RiesgoConfigDto;
}

export class UpdateTenantConfigDto {
  // Cambiar de perfil aplica sus valores sugeridos y descarta los ajustes
  // propios anteriores (salvo los que vengan en este mismo request).
  @IsOptional()
  @IsIn(PERFIL_IDS)
  perfil?: PerfilId;

  // true = descarta los ajustes propios y vuelve a los valores del perfil.
  @IsOptional()
  @IsBoolean()
  restablecer?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => ConfiguracionDto)
  configuracion?: ConfiguracionDto;
}
