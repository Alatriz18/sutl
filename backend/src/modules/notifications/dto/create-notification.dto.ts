import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { CanalNotificacion } from '@prisma/client';

export class CreateNotificationDto {
  @IsEnum(CanalNotificacion)
  canal: CanalNotificacion;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  tipo: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  asunto: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  mensaje: string;

  // Correo o teléfono internacional (+593…); si falta y es correo, se usa el del usuario.
  @IsOptional()
  @IsString()
  @MaxLength(120)
  destino?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;
}
