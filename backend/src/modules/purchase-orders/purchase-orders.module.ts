import { Module } from '@nestjs/common';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseOrderShipmentsService } from './purchase-order-shipments.service';
import { PurchaseOrdersImportService } from './purchase-orders-import.service';
import { TenantConfigModule } from '../tenant-config/tenant-config.module';

@Module({
  imports: [TenantConfigModule],
  controllers: [PurchaseOrdersController],
  providers: [PurchaseOrdersService, PurchaseOrderShipmentsService, PurchaseOrdersImportService],
  exports: [PurchaseOrdersService],
})
export class PurchaseOrdersModule {}
