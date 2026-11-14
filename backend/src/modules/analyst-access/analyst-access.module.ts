import { Global, Module } from '@nestjs/common';
import { AnalystAccessController } from './analyst-access.controller';
import { AnalystAccessGuard } from './analyst-access.guard';
import { AnalystAccessService } from './analyst-access.service';

// Global: el guard se registra como APP_GUARD en AppModule y el servicio lo usa Auth.
@Global()
@Module({
  controllers: [AnalystAccessController],
  providers: [AnalystAccessService, AnalystAccessGuard],
  exports: [AnalystAccessService, AnalystAccessGuard],
})
export class AnalystAccessModule {}
