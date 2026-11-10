import { Module } from '@nestjs/common';
import { InventoryCoverageModule } from '../inventory-coverage/inventory-coverage.module';
import { SupplyRiskController } from './supply-risk.controller';
import { SupplyRiskService } from './supply-risk.service';

@Module({
  imports: [InventoryCoverageModule],
  controllers: [SupplyRiskController],
  providers: [SupplyRiskService],
  exports: [SupplyRiskService],
})
export class SupplyRiskModule {}
