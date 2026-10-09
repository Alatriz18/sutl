import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreatePartnerDto } from './create-partner.dto';

export class UpdatePartnerDto extends PartialType(CreatePartnerDto) {
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
