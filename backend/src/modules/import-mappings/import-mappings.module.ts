import { Module } from '@nestjs/common';
import { ImportMappingsController } from './import-mappings.controller';
import { ImportMappingsService } from './import-mappings.service';

@Module({
  controllers: [ImportMappingsController],
  providers: [ImportMappingsService],
})
export class ImportMappingsModule {}
