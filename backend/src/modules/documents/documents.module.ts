import { Module } from '@nestjs/common';
import { TenantConfigModule } from '../tenant-config/tenant-config.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { SharedDocumentsService } from './shared-documents.service';

@Module({
  imports: [TenantConfigModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, SharedDocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
