import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { TipoPartner } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PartnersService } from './partners.service';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';

@Controller('partners')
export class PartnersController {
  constructor(private readonly partnersService: PartnersService) {}

  @Get()
  findAll(@CurrentUser('tenantId') tenantId: string, @Query('tipo') tipo?: TipoPartner) {
    return this.partnersService.findAll(tenantId, tipo);
  }

  @Get(':id')
  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.partnersService.findOne(tenantId, id);
  }

  @Post()
  create(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreatePartnerDto) {
    return this.partnersService.create(tenantId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePartnerDto,
  ) {
    return this.partnersService.update(tenantId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.partnersService.remove(tenantId, id);
  }
}
