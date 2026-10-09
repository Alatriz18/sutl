import { IsOptional, IsUUID } from 'class-validator';

export class CreateAssignmentDto {
  @IsUUID()
  vehicleId: string;

  @IsUUID()
  driverId: string;

  @IsOptional()
  @IsUUID()
  shipmentId?: string;
}
