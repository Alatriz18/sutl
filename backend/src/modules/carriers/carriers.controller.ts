import { Controller, Get } from '@nestjs/common';
import { CarriersService } from './carriers.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('carriers')
@Controller('carriers')
export class CarriersController {
  constructor(private readonly carriersService: CarriersService) {}

  @Get()
  findAll() {
    return this.carriersService.findAll();
  }
}
