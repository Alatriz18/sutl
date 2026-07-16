import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TrackingEventsController } from './tracking-events.controller';
import { TrackingEventsService } from './tracking-events.service';
import { TrackingEvent, TrackingEventSchema } from './schemas/tracking-event.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: TrackingEvent.name, schema: TrackingEventSchema }]),
  ],
  controllers: [TrackingEventsController],
  providers: [TrackingEventsService],
  exports: [TrackingEventsService, MongooseModule],
})
export class TrackingEventsModule {}
