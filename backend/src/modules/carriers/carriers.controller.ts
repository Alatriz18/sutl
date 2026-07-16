import { Controller, Get } from '@nestjs/common';
import { CarriersService } from './carriers.service';

@Controller('carriers')
export class CarriersController {
  constructor(private readonly carriersService: CarriersService) {}

  @Get()
  findAll() {
    return this.carriersService.findAll();
  }
}
