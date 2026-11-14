import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/jwt-payload.interface';
import { Roles } from '../../common/decorators/roles.decorator';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseOrderShipmentsService } from './purchase-order-shipments.service';
import { LinkShipmentDto } from './dto/link-shipment.dto';
import { PurchaseOrdersImportService } from './purchase-orders-import.service';
import { ImportPurchaseOrdersDto } from './dto/import-purchase-orders.dto';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { TransitionPurchaseOrderDto } from './dto/transition-purchase-order.dto';
import { RegisterReceiptDto } from './dto/register-receipt.dto';
import { QueryPurchaseOrdersDto } from './dto/query-purchase-orders.dto';

// Las OCs son información interna de compras del tenant: el cliente_final
// (destinatario de envíos) no tiene acceso.
@ApiTags('purchase-orders')
@Roles(RolUsuario.admin_tenant, RolUsuario.operador, RolUsuario.super_admin)
@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(
    private readonly purchaseOrdersService: PurchaseOrdersService,
    private readonly shipmentsLinkService: PurchaseOrderShipmentsService,
    private readonly importService: PurchaseOrdersImportService,
  ) {}

  // El proveedor externo también entra, pero solo ve SUS órdenes (ya emitidas) y con
  // lo mínimo: el filtro lo impone el servidor según su usuario, nunca el parámetro.
  @Get()
  @Roles(RolUsuario.admin_tenant, RolUsuario.operador, RolUsuario.super_admin, RolUsuario.proveedor)
  async findAll(@CurrentUser() user: RequestUser, @Query() query: QueryPurchaseOrdersDto) {
    if (user.rol === RolUsuario.proveedor) {
      const partnerId = await this.purchaseOrdersService.proveedorDe(user.tenantId, user.userId);
      return this.purchaseOrdersService.findAllDeProveedor(user.tenantId, partnerId, query);
    }
    return this.purchaseOrdersService.findAll(user.tenantId, query);
  }

  @Get(':id')
  @Roles(RolUsuario.admin_tenant, RolUsuario.operador, RolUsuario.super_admin, RolUsuario.proveedor)
  async findOne(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    if (user.rol === RolUsuario.proveedor) {
      const partnerId = await this.purchaseOrdersService.proveedorDe(user.tenantId, user.userId);
      return this.purchaseOrdersService.findOneDeProveedor(user.tenantId, partnerId, id);
    }
    return this.purchaseOrdersService.findOne(user.tenantId, id);
  }

  // Importación masiva desde Excel/CSV. Antes de las rutas con ':id'.
  @Post('importar')
  importar(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: ImportPurchaseOrdersDto,
  ) {
    return this.importService.importar(tenantId, userId, dto);
  }

  @Post()
  create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreatePurchaseOrderDto,
  ) {
    return this.purchaseOrdersService.create(tenantId, userId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePurchaseOrderDto,
  ) {
    return this.purchaseOrdersService.update(tenantId, id, dto);
  }

  @Post(':id/transicion')
  transicion(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransitionPurchaseOrderDto,
  ) {
    return this.purchaseOrdersService.transicion(tenantId, id, dto);
  }

  @Post(':id/recepciones')
  registrarRecepcion(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegisterReceiptDto,
  ) {
    return this.purchaseOrdersService.registrarRecepcion(tenantId, userId, id, dto);
  }

  // Asigna cantidades de las líneas de la OC a un embarque (0 quita la línea).
  @Post(':id/embarques')
  vincularEmbarque(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LinkShipmentDto,
  ) {
    return this.shipmentsLinkService.vincular(tenantId, id, dto);
  }

  @Delete(':id/embarques/:shipmentId')
  desvincularEmbarque(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('shipmentId', ParseUUIDPipe) shipmentId: string,
  ) {
    return this.shipmentsLinkService.desvincular(tenantId, id, shipmentId);
  }
}
