import { Module } from '@nestjs/common';
import { PurchaseOrdersModule } from '../purchase-orders/purchase-orders.module';
import { TrackingEventsModule } from '../tracking-events/tracking-events.module';
import { DeliveryController } from './delivery.controller';
import { DeliveryService } from './delivery.service';

@Module({
  imports: [TrackingEventsModule, PurchaseOrdersModule],
  controllers: [DeliveryController],
  providers: [DeliveryService],
})
export class DeliveryModule {}
