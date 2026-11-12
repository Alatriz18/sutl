import { Controller, Get, NotFoundException, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { EstadoEnvio, EstadoOrdenCompra } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { SupplyRiskService } from '../supply-risk/supply-risk.service';
import { TrackingEventsService } from '../tracking-events/tracking-events.service';
import { ApiKeyGuard } from './api-key.guard';

class PaginaQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limite?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  desde?: number;
}

class EnviosQuery extends PaginaQuery {
  @IsOptional()
  @IsEnum(EstadoEnvio)
  estado?: EstadoEnvio;
}

class OrdenesQuery extends PaginaQuery {
  @IsOptional()
  @IsEnum(EstadoOrdenCompra)
  estado?: EstadoOrdenCompra;
}

// API pública v1 (solo lectura), autenticada con X-API-Key. Es un contrato
// aparte de la API interna del panel: aquí solo salen los campos que se
// decidió publicar, y SIEMPRE de la empresa dueña de la clave.
@ApiExcludeController()
@Public() // salta el JWT del panel; la autenticación la hace ApiKeyGuard
@UseGuards(ApiKeyGuard)
@Throttle({ default: { limit: 300, ttl: 60_000 } })
@Controller('v1')
export class PublicApiController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly risk: SupplyRiskService,
    private readonly tracking: TrackingEventsService,
  ) {}

  @Get('shipments')
  async envios(@Req() req: { apiTenantId: string }, @Query() q: EnviosQuery) {
    const where = { tenantId: req.apiTenantId, ...(q.estado ? { estado: q.estado } : {}) };
    const [total, datos] = await Promise.all([
      this.prisma.shipment.count({ where }),
      this.prisma.shipment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: q.limite ?? 50,
        skip: q.desde ?? 0,
        select: ENVIO,
      }),
    ]);
    return { total, limite: q.limite ?? 50, desde: q.desde ?? 0, datos };
  }

  @Get('shipments/:codigoGuia')
  async envio(@Req() req: { apiTenantId: string }, @Param('codigoGuia') codigoGuia: string) {
    const envio = await this.prisma.shipment.findFirst({ where: { tenantId: req.apiTenantId, codigoGuia }, select: ENVIO });
    if (!envio) throw new NotFoundException('Envío no encontrado');
    // El envío ya se verificó como de esta empresa; los eventos se buscan por su guía.
    const eventos = await this.tracking.findByCodigoGuia(envio.codigoGuia);
    return { ...envio, eventos: eventos.map((e) => ({ estado: e.estado, ubicacion: e.ubicacion, descripcion: e.descripcion, timestamp: e.timestamp })) };
  }

  @Get('purchase-orders')
  async ordenes(@Req() req: { apiTenantId: string }, @Query() q: OrdenesQuery) {
    const where = { tenantId: req.apiTenantId, ...(q.estado ? { estado: q.estado } : {}) };
    const [total, datos] = await Promise.all([
      this.prisma.purchaseOrder.count({ where }),
      this.prisma.purchaseOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: q.limite ?? 50,
        skip: q.desde ?? 0,
        select: {
          numero: true,
          estado: true,
          moneda: true,
          incoterm: true,
          fechaEmision: true,
          fechaRequerida: true,
          fechaConfirmadaProveedor: true,
          fechaDespacho: true,
          proveedor: { select: { nombre: true } },
          lineas: { select: { sku: true, descripcion: true, unidad: true, cantidad: true, cantidadRecibida: true } },
        },
      }),
    ]);
    return { total, limite: q.limite ?? 50, desde: q.desde ?? 0, datos };
  }

  @Get('supply-risk')
  async riesgo(@Req() req: { apiTenantId: string }) {
    return this.risk.evaluar(req.apiTenantId);
  }
}

const ENVIO = {
  codigoGuia: true,
  tipo: true,
  modo: true,
  estado: true,
  referenciaDocumento: true,
  remitenteNombre: true,
  destinatarioNombre: true,
  origen: true,
  destino: true,
  puertoOrigen: true,
  puertoDestino: true,
  pesoKg: true,
  fechaEstimadaSalida: true,
  fechaEstimadaLlegada: true,
  createdAt: true,
  updatedAt: true,
} as const;
