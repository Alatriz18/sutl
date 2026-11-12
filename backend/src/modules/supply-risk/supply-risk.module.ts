import { Module } from '@nestjs/common';
import { InventoryCoverageModule } from '../inventory-coverage/inventory-coverage.module';
import { TenantConfigModule } from '../tenant-config/tenant-config.module';
import { RiskMonitorProcessor } from './risk-monitor.processor';
import { RiskMonitorService } from './risk-monitor.service';
import { SupplyRiskController } from './supply-risk.controller';
import { SupplyRiskService } from './supply-risk.service';

// El procesador de la ronda programada solo existe si hay Redis.
@Module({
  imports: [InventoryCoverageModule, TenantConfigModule],
  controllers: [SupplyRiskController],
  providers: [SupplyRiskService, RiskMonitorService, ...(process.env.REDIS_URL ? [RiskMonitorProcessor] : [])],
  exports: [SupplyRiskService, RiskMonitorService],
})
export class SupplyRiskModule {}
