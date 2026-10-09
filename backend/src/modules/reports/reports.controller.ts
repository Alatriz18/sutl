import { Body, Controller, Get, NotFoundException, Param, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { join } from 'path';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  findAll(@CurrentUser('tenantId') tenantId: string) {
    return this.reportsService.findAll(tenantId);
  }

  @Post()
  create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateReportDto,
  ) {
    return this.reportsService.create(tenantId, userId, dto);
  }

  @Get(':id/download')
  async download(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const report = await this.reportsService.findOne(tenantId, id);
    if (!report.urlArchivo) {
      throw new NotFoundException('Este reporte todavía no tiene un archivo generado');
    }
    const rutaAbsoluta = join(process.cwd(), report.urlArchivo);
    res.download(rutaAbsoluta, `${report.tipo}.csv`);
  }
}
