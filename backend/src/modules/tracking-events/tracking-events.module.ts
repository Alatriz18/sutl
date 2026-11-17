import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TrackingEventsController } from './tracking-events.controller';
import { TrackingEventsService } from './tracking-events.service';
import { TrackingEvent, TrackingEventSchema } from './schemas/tracking-event.schema';
import { TrackingStreamService } from './tracking-stream.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: TrackingEvent.name, schema: TrackingEventSchema }]),
  ],
  controllers: [TrackingEventsController],
  providers: [TrackingEventsService, TrackingStreamService],
  exports: [TrackingEventsService, TrackingStreamService, MongooseModule],
})
export class TrackingEventsModule {}
