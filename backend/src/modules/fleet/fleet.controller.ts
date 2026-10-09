import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FleetService } from './fleet.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { CreateDriverDto } from './dto/create-driver.dto';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';

@Controller()
export class FleetController {
  constructor(private readonly fleetService: FleetService) {}

  @Get('vehicles')
  findAllVehicles(@CurrentUser('tenantId') tenantId: string) {
    return this.fleetService.findAllVehicles(tenantId);
  }

  @Get('vehicles/:id')
  findVehicle(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.fleetService.findVehicle(tenantId, id);
  }

  @Post('vehicles')
  createVehicle(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateVehicleDto) {
    return this.fleetService.createVehicle(tenantId, dto);
  }

  @Patch('vehicles/:id')
  updateVehicle(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateVehicleDto,
  ) {
    return this.fleetService.updateVehicle(tenantId, id, dto);
  }

  @Post('vehicles/:id/maintenance')
  createMaintenance(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: CreateMaintenanceDto,
  ) {
    return this.fleetService.createMaintenance(tenantId, id, dto);
  }

  @Get('drivers')
  findAllDrivers(@CurrentUser('tenantId') tenantId: string) {
    return this.fleetService.findAllDrivers(tenantId);
  }

  @Post('drivers')
  createDriver(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateDriverDto) {
    return this.fleetService.createDriver(tenantId, dto);
  }

  @Get('vehicle-assignments')
  findAllAssignments(@CurrentUser('tenantId') tenantId: string) {
    return this.fleetService.findAllAssignments(tenantId);
  }

  @Post('vehicle-assignments')
  createAssignment(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateAssignmentDto) {
    return this.fleetService.createAssignment(tenantId, dto);
  }

  @Patch('vehicle-assignments/:id/finalizar')
  finalizarAsignacion(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.fleetService.finalizarAsignacion(tenantId, id);
  }
}
