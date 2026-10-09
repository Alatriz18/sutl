import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { ShipmentsModule } from '../shipments/shipments.module';

@Module({
  imports: [ShipmentsModule],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
