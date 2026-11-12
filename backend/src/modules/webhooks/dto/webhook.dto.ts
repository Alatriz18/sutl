import { ArrayMaxSize, ArrayNotEmpty, ArrayUnique, IsArray, IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { EVENTOS_WEBHOOK } from '../webhook-events';

export class CreateWebhookDto {
  @IsString()
  @MaxLength(500)
  url: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(EVENTOS_WEBHOOK.length)
  @ArrayUnique()
  @IsIn(EVENTOS_WEBHOOK, { each: true, message: `Cada evento debe ser uno de: ${EVENTOS_WEBHOOK.join(', ')}` })
  eventos: string[];
}

export class UpdateWebhookDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  url?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(EVENTOS_WEBHOOK.length)
  @ArrayUnique()
  @IsIn(EVENTOS_WEBHOOK, { each: true, message: `Cada evento debe ser uno de: ${EVENTOS_WEBHOOK.join(', ')}` })
  eventos?: string[];

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
