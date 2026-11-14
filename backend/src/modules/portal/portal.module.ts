import { Module } from '@nestjs/common';
import { PurchaseOrdersModule } from '../purchase-orders/purchase-orders.module';
import { PortalController } from './portal.controller';
import { PortalService } from './portal.service';

@Module({
  imports: [PurchaseOrdersModule],
  controllers: [PortalController],
  providers: [PortalService],
})
export class PortalModule {}
