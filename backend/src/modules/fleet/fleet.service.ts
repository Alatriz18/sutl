import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { CreateDriverDto } from './dto/create-driver.dto';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';

@Injectable()
export class FleetService {
  constructor(private readonly prisma: PrismaService) {}

  findAllVehicles(tenantId: string) {
    return this.prisma.vehicle.findMany({
      where: { tenantId },
      include: {
        asignaciones: { where: { fechaFin: null }, include: { driver: true }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findVehicle(tenantId: string, id: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id, tenantId },
      include: { asignaciones: { include: { driver: true } }, mantenimientos: true },
    });
    if (!vehicle) {
      throw new NotFoundException('Vehículo no encontrado');
    }
    return vehicle;
  }

  createVehicle(tenantId: string, dto: CreateVehicleDto) {
    return this.prisma.vehicle.create({ data: { ...dto, tenantId } });
  }

  async updateVehicle(tenantId: string, id: string, dto: UpdateVehicleDto) {
    await this.findVehicle(tenantId, id);
    return this.prisma.vehicle.update({ where: { id }, data: dto });
  }

  findAllDrivers(tenantId: string) {
    return this.prisma.driver.findMany({ where: { tenantId }, orderBy: { nombre: 'asc' } });
  }

  createDriver(tenantId: string, dto: CreateDriverDto) {
    return this.prisma.driver.create({ data: { ...dto, tenantId } });
  }

  findAllAssignments(tenantId: string) {
    return this.prisma.vehicleAssignment.findMany({
      where: { tenantId },
      include: { vehicle: true, driver: true, shipment: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createAssignment(tenantId: string, dto: CreateAssignmentDto) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: dto.vehicleId, tenantId },
    });
    if (!vehicle) {
      throw new NotFoundException('Vehículo no encontrado');
    }
    const [assignment] = await this.prisma.$transaction([
      this.prisma.vehicleAssignment.create({
        data: { ...dto, tenantId },
        include: { vehicle: true, driver: true },
      }),
      this.prisma.vehicle.update({ where: { id: dto.vehicleId }, data: { estado: 'en_ruta' } }),
    ]);
    return assignment;
  }

  async finalizarAsignacion(tenantId: string, id: string) {
    const assignment = await this.prisma.vehicleAssignment.findFirst({
      where: { id, tenantId },
    });
    if (!assignment) {
      throw new NotFoundException('Asignación no encontrada');
    }
    const [updated] = await this.prisma.$transaction([
      this.prisma.vehicleAssignment.update({
        where: { id },
        data: { fechaFin: new Date() },
      }),
      this.prisma.vehicle.update({
        where: { id: assignment.vehicleId },
        data: { estado: 'disponible' },
      }),
    ]);
    return updated;
  }

  async createMaintenance(tenantId: string, vehicleId: string, dto: CreateMaintenanceDto) {
    const vehicle = await this.prisma.vehicle.findFirst({ where: { id: vehicleId, tenantId } });
    if (!vehicle) {
      throw new NotFoundException('Vehículo no encontrado');
    }
    const [record] = await this.prisma.$transaction([
      this.prisma.maintenanceRecord.create({ data: { ...dto, tenantId, vehicleId } }),
      this.prisma.vehicle.update({ where: { id: vehicleId }, data: { estado: 'mantenimiento' } }),
    ]);
    return record;
  }
}
