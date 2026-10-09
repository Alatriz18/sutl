import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ContainersService } from './containers.service';
import { CreateContainerDto } from './dto/create-container.dto';
import { UpdateContainerDto } from './dto/update-container.dto';

@Controller('containers')
export class ContainersController {
  constructor(private readonly containersService: ContainersService) {}

  @Get()
  findAll(@CurrentUser('tenantId') tenantId: string) {
    return this.containersService.findAll(tenantId);
  }

  @Get(':id')
  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.containersService.findOne(tenantId, id);
  }

  @Post()
  create(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateContainerDto) {
    return this.containersService.create(tenantId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateContainerDto,
  ) {
    return this.containersService.update(tenantId, id, dto);
  }

  @Post(':id/envios/:shipmentId')
  asignarEnvio(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Param('shipmentId') shipmentId: string,
  ) {
    return this.containersService.asignarEnvio(tenantId, id, shipmentId);
  }
}
