import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
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

export class ExcepcionesConfigDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(720)
  slaAltaHoras?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(720)
  slaMediaHoras?: number;

  @IsOptional()
  @IsBoolean()
  crearTareas?: boolean;
}

export class DocumentosConfigDto {
  @IsOptional()
  @IsBoolean()
  exigirFactura?: boolean;

  @IsOptional()
  @IsBoolean()
  exigirPackingList?: boolean;

  @IsOptional()
  @IsBoolean()
  exigirDocumentoTransporte?: boolean;

  @IsOptional()
  @IsBoolean()
  exigirPedimento?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  diasAvisoVencimiento?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(90)
  diasAntesEtaFaltante?: number;

  @IsOptional()
  @IsBoolean()
  avisarVencimientos?: boolean;
}

export class AnaliticaConfigDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(1)
  @Max(100)
  metaOtifPct?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(1)
  @Max(100)
  umbralAtencionOtifPct?: number;
}

export class SeguridadConfigDto {
  @IsOptional()
  @IsBoolean()
  exigirMfaAdministradores?: boolean;
}

export class MarcaConfigDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  nombreComercial?: string;

  // #RRGGBB, o vacío para volver al color de SUTL.
  @IsOptional()
  @Matches(/^(#[0-9a-fA-F]{6})?$/, { message: 'colorPrimario debe tener el formato #RRGGBB' })
  colorPrimario?: string;

  // Dirección https de la imagen, o vacío para quitar el logo.
  @IsOptional()
  @Matches(/^(https:\/\/[^\s"'<>]{1,280})?$/, { message: 'logoUrl debe ser una dirección https válida' })
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  mensaje?: string;

  @IsOptional()
  @IsBoolean()
  mostrarSutl?: boolean;
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

  @IsOptional()
  @ValidateNested()
  @Type(() => ExcepcionesConfigDto)
  excepciones?: ExcepcionesConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DocumentosConfigDto)
  documentos?: DocumentosConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AnaliticaConfigDto)
  analitica?: AnaliticaConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SeguridadConfigDto)
  seguridad?: SeguridadConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MarcaConfigDto)
  marca?: MarcaConfigDto;
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
