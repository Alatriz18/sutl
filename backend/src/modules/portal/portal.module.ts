import { Module } from '@nestjs/common';
import { PurchaseOrdersModule } from '../purchase-orders/purchase-orders.module';
import { ShipmentsModule } from '../shipments/shipments.module';
import { PortalDespachoService } from './portal-despacho.service';
import { PortalController } from './portal.controller';
import { PortalService } from './portal.service';

@Module({
  imports: [PurchaseOrdersModule, ShipmentsModule],
  controllers: [PortalController],
  providers: [PortalService, PortalDespachoService],
})
export class PortalModule {}
