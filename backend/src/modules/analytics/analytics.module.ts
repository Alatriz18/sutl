import { Module } from '@nestjs/common';
import { TrackingEventsModule } from '../tracking-events/tracking-events.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [TrackingEventsModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
