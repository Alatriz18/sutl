import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// Catálogo global de navieras/aerolíneas (compartido por todos los tenants).
// Solo lectura por ahora — la administración del catálogo y las credenciales
// de integración por tenant (CarrierCredential) quedan para una fase futura.
@Injectable()
export class CarriersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.carrier.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
    });
  }
}
