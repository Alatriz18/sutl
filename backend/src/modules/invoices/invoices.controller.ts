import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  findAll(@CurrentUser('tenantId') tenantId: string) {
    return this.invoicesService.findAll(tenantId);
  }

  @Get(':id')
  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.invoicesService.findOne(tenantId, id);
  }

  @Post()
  create(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateInvoiceDto) {
    return this.invoicesService.create(tenantId, dto);
  }

  @Post(':id/pagos')
  registrarPago(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.invoicesService.registrarPago(tenantId, id, dto);
  }
}
