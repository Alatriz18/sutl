import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RatesService } from './rates.service';
import { CreateRateDto } from './dto/create-rate.dto';
import { UpdateRateDto } from './dto/update-rate.dto';

@Controller('rates')
export class RatesController {
  constructor(private readonly ratesService: RatesService) {}

  @Get()
  findAll(@CurrentUser('tenantId') tenantId: string) {
    return this.ratesService.findAll(tenantId);
  }

  @Get(':id')
  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.ratesService.findOne(tenantId, id);
  }

  @Post()
  create(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateRateDto) {
    return this.ratesService.create(tenantId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRateDto,
  ) {
    return this.ratesService.update(tenantId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.ratesService.remove(tenantId, id);
  }
}
