import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TrackingEventsService } from './tracking-events.service';
import { CreateTrackingEventDto } from './dto/create-tracking-event.dto';

@Controller('tracking-events')
export class TrackingEventsController {
  constructor(private readonly trackingEventsService: TrackingEventsService) {}

  @Post()
  create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('email') responsable: string,
    @Body() dto: CreateTrackingEventDto,
  ) {
    return this.trackingEventsService.create(tenantId, responsable, dto);
  }

  @Get('shipment/:shipmentId')
  findByShipment(
    @CurrentUser('tenantId') tenantId: string,
    @Param('shipmentId') shipmentId: string,
  ) {
    return this.trackingEventsService.findByShipment(tenantId, shipmentId);
  }
}
