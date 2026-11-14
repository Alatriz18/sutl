import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { SupplyRiskModule } from '../supply-risk/supply-risk.module';
import { ControlTowerController } from './control-tower.controller';
import { ControlTowerService } from './control-tower.service';

@Module({
  imports: [SupplyRiskModule, DocumentsModule],
  controllers: [ControlTowerController],
  providers: [ControlTowerService],
})
export class ControlTowerModule {}
