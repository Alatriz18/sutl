import { EstadoEnvio, EstadoOrdenCompra } from '@/types';

// Lo que el servidor devuelve a un proveedor externo sobre SUS órdenes de compra
// (ver backend/src/modules/purchase-orders: SELECT_PROVEEDOR). No incluye notas
// internas, quién la creó ni recepciones en bodega.
export interface OrdenDeProveedor {
  id: string;
  numero: string;
  estado: EstadoOrdenCompra;
  incoterm: string | null;
  moneda: string;
  fechaEmision: string;
  fechaRequerida: string | null;
  fechaConfirmadaProveedor: string | null;
  fechaDespacho: string | null;
  proveedor: { id: string; nombre: string };
  lineas: {
    id: string;
    sku: string;
    descripcion: string;
    unidad: string;
    cantidad: number;
    cantidadRecibida: number;
    precioUnitario: number | null;
    embarques: { cantidad: number; shipment: { id: string; codigoGuia: string; estado: EstadoEnvio; fechaEstimadaLlegada: string | null } }[];
  }[];
}
