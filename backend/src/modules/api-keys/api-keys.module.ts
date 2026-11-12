import { Module } from '@nestjs/common';
import { SupplyRiskModule } from '../supply-risk/supply-risk.module';
import { TrackingEventsModule } from '../tracking-events/tracking-events.module';
import { ApiKeyGuard } from './api-key.guard';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';
import { PublicApiController } from './public-api.controller';

@Module({
  imports: [SupplyRiskModule, TrackingEventsModule],
  controllers: [ApiKeysController, PublicApiController],
  providers: [ApiKeysService, ApiKeyGuard],
  exports: [ApiKeysService],
})
export class ApiKeysModule {}
