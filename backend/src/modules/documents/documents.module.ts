import { Module } from '@nestjs/common';
import { TenantConfigModule } from '../tenant-config/tenant-config.module';
import { DocumentsController } from './documents.controller';
import { DocumentExpiryMonitorProcessor } from './document-expiry-monitor.processor';
import { DocumentExpiryMonitorService } from './document-expiry-monitor.service';
import { DocumentsService } from './documents.service';
import { SharedDocumentsService } from './shared-documents.service';

@Module({
  imports: [TenantConfigModule],
  controllers: [DocumentsController],
  // El procesador de la ronda programada solo existe si hay Redis.
  providers: [DocumentsService, SharedDocumentsService, DocumentExpiryMonitorService, ...(process.env.REDIS_URL ? [DocumentExpiryMonitorProcessor] : [])],
  exports: [DocumentsService, DocumentExpiryMonitorService],
})
export class DocumentsModule {}
