import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { SupplyRiskModule } from '../supply-risk/supply-risk.module';
import { TenantConfigModule } from '../tenant-config/tenant-config.module';
import { ExceptionsController } from './exceptions.controller';
import { ExceptionsProcessor } from './exceptions.processor';
import { ExceptionsService } from './exceptions.service';

// El procesador de la ronda programada solo existe si hay Redis.
@Module({
  imports: [SupplyRiskModule, DocumentsModule, TenantConfigModule],
  controllers: [ExceptionsController],
  providers: [ExceptionsService, ...(process.env.REDIS_URL ? [ExceptionsProcessor] : [])],
  exports: [ExceptionsService],
})
export class ExceptionsModule {}
