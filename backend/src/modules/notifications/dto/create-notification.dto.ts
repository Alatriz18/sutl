import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { CanalNotificacion } from '@prisma/client';

export class CreateNotificationDto {
  @IsEnum(CanalNotificacion)
  canal: CanalNotificacion;

  @IsString()
  @IsNotEmpty()
  tipo: string;

  @IsString()
  @IsNotEmpty()
  asunto: string;

  @IsString()
  @IsNotEmpty()
  mensaje: string;

  @IsOptional()
  @IsUUID()
  userId?: string;
}
