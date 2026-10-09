import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  findAll(@CurrentUser('tenantId') tenantId: string) {
    return this.bookingsService.findAll(tenantId);
  }

  @Get(':id')
  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.bookingsService.findOne(tenantId, id);
  }

  @Post()
  create(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateBookingDto) {
    return this.bookingsService.create(tenantId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateBookingDto,
  ) {
    return this.bookingsService.update(tenantId, id, dto);
  }

  @Post(':id/convertir-a-envio')
  convertir(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.bookingsService.convertirAEnvio(tenantId, id);
  }
}
