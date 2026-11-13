import { Module } from '@nestjs/common';
import { SupplyRiskModule } from '../supply-risk/supply-risk.module';
import { TenantConfigModule } from '../tenant-config/tenant-config.module';
import { ExceptionsController } from './exceptions.controller';
import { ExceptionsProcessor } from './exceptions.processor';
import { ExceptionsService } from './exceptions.service';

// El procesador de la ronda programada solo existe si hay Redis.
@Module({
  imports: [SupplyRiskModule, TenantConfigModule],
  controllers: [ExceptionsController],
  providers: [ExceptionsService, ...(process.env.REDIS_URL ? [ExceptionsProcessor] : [])],
  exports: [ExceptionsService],
})
export class ExceptionsModule {}
