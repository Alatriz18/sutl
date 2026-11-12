import { Type } from 'class-transformer';
import { EstadoTarea, PrioridadTarea } from '@prisma/client';
import { IsDate, IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';

export const ENTIDADES_TAREA = ['orden_compra', 'envio', 'sku'] as const;
export type EntidadTarea = (typeof ENTIDADES_TAREA)[number];

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  titulo: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descripcion?: string;

  @IsOptional()
  @IsEnum(PrioridadTarea)
  prioridad?: PrioridadTarea;

  @IsOptional()
  @IsUUID()
  asignadoAId?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  fechaLimite?: Date;

  @IsOptional()
  @IsIn(ENTIDADES_TAREA)
  entidadTipo?: EntidadTarea;

  // orden_compra y envio: UUID del registro; sku: el código del SKU.
  @ValidateIf((o: CreateTaskDto) => o.entidadTipo !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  entidadId?: string;
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  titulo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descripcion?: string;

  @IsOptional()
  @IsEnum(EstadoTarea)
  estado?: EstadoTarea;

  @IsOptional()
  @IsEnum(PrioridadTarea)
  prioridad?: PrioridadTarea;

  // null = quitar el responsable (IsOptional deja pasar null).
  @IsOptional()
  @IsUUID()
  asignadoAId?: string | null;

  // null = quitar la fecha límite.
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  fechaLimite?: Date | null;
}

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  texto: string;
}

export class ListTasksQueryDto {
  @IsOptional()
  @IsEnum(EstadoTarea)
  estado?: EstadoTarea;

  @IsOptional()
  @IsUUID()
  asignadoAId?: string;

  // 'true' = solo las asignadas a quien consulta.
  @IsOptional()
  @IsIn(['true', 'false'])
  mias?: string;

  @IsOptional()
  @IsIn(ENTIDADES_TAREA)
  entidadTipo?: EntidadTarea;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  entidadId?: string;
}
