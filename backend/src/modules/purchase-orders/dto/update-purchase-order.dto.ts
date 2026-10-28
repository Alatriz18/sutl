import { PartialType } from '@nestjs/mapped-types';
import { CreatePurchaseOrderDto } from './create-purchase-order.dto';

// numero, proveedorId, moneda y lineas solo se pueden cambiar en borrador
// (ver PurchaseOrdersService.update); el resto se puede ajustar mientras la
// OC no esté cerrada, ej. el proveedor mueve su fecha confirmada.
export class UpdatePurchaseOrderDto extends PartialType(CreatePurchaseOrderDto) {}
