import { Module } from '@nestjs/common';
import { TenantConfigModule } from '../tenant-config/tenant-config.module';
import { InventoryCoverageController } from './inventory-coverage.controller';
import { InventoryCoverageService } from './inventory-coverage.service';

@Module({
  imports: [TenantConfigModule],
  controllers: [InventoryCoverageController],
  providers: [InventoryCoverageService],
  exports: [InventoryCoverageService],
})
export class InventoryCoverageModule {}
