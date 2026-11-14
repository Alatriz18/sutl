import { Module } from '@nestjs/common';
import { SupplyRiskModule } from '../supply-risk/supply-risk.module';
import { ControlTowerController } from './control-tower.controller';
import { ControlTowerService } from './control-tower.service';

@Module({
  imports: [SupplyRiskModule],
  controllers: [ControlTowerController],
  providers: [ControlTowerService],
})
export class ControlTowerModule {}
