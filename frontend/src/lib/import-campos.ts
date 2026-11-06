import { TipoImportacion } from '@/types';

export type TipoCampo = 'texto' | 'numero' | 'entero' | 'fecha';

export interface CampoImportacion {
  key: string;
  label: string;
  tipo: TipoCampo;
  requerido?: boolean;
  ayuda?: string;
  // Nombres de columna habituales en los Excel/ERP de la región (se comparan
  // sin tildes, mayúsculas ni signos) para sugerir el mapeo automáticamente.
  sinonimos: string[];
  ejemplo: string;
}

export const CAMPOS_OC: CampoImportacion[] = [
  { key: 'numero', label: 'N° de OC', tipo: 'texto', requerido: true, ayuda: 'Las filas con el mismo número forman una sola OC.', sinonimos: ['numero', 'nro', 'no', 'oc', 'orden', 'ordendecompra', 'pedido', 'po', 'nropedido', 'numerooc', 'ocnumero', 'purchaseorder', 'npedido', 'noc', 'norden', 'nrooc', 'nroorden', 'numeropedido', 'numeroorden', 'numerodeoc', 'ordencompra'], ejemplo: 'OC-2026-0500' },
  { key: 'proveedor', label: 'Proveedor (nombre)', tipo: 'texto', ayuda: 'Debe coincidir con un proveedor de Contactos. Si no, puedes pedir crearlo.', sinonimos: ['proveedor', 'vendor', 'supplier', 'nombreproveedor', 'razonsocial', 'nombre'], ejemplo: 'Ningbo Polymer Materials Co.' },
  { key: 'proveedorTaxId', label: 'Proveedor (RUC / Tax ID)', tipo: 'texto', ayuda: 'Más preciso que el nombre; tiene prioridad si lo mapeas.', sinonimos: ['ruc', 'taxid', 'rucproveedor', 'nit', 'identificacion', 'rfc'], ejemplo: '' },
  { key: 'incoterm', label: 'Incoterm', tipo: 'texto', sinonimos: ['incoterm', 'incoterms'], ejemplo: 'FOB' },
  { key: 'moneda', label: 'Moneda', tipo: 'texto', ayuda: 'Código de 3 letras (USD, EUR).', sinonimos: ['moneda', 'currency', 'divisa'], ejemplo: 'USD' },
  { key: 'fechaEmision', label: 'Fecha de emisión', tipo: 'fecha', sinonimos: ['fechaemision', 'emision', 'fechaoc', 'fechapedido', 'orderdate', 'fecha'], ejemplo: '15/11/2026' },
  { key: 'fechaRequerida', label: 'Fecha requerida en planta', tipo: 'fecha', sinonimos: ['fecharequerida', 'requerida', 'fechaentrega', 'fechanecesidad', 'requireddate', 'needby', 'fechaplanta'], ejemplo: '20/12/2026' },
  { key: 'fechaConfirmadaProveedor', label: 'Fecha confirmada por el proveedor', tipo: 'fecha', sinonimos: ['fechaconfirmada', 'confirmada', 'fechaprometida', 'promesaproveedor', 'etd', 'fechaconfirmadaproveedor'], ejemplo: '' },
  { key: 'notas', label: 'Notas', tipo: 'texto', sinonimos: ['notas', 'observaciones', 'comentarios', 'obs', 'nota'], ejemplo: '' },
  { key: 'sku', label: 'SKU / código', tipo: 'texto', requerido: true, sinonimos: ['sku', 'codigo', 'codigoproducto', 'item', 'referencia', 'material', 'articulo', 'partnumber', 'codigoarticulo'], ejemplo: 'RES-PET-01' },
  { key: 'descripcion', label: 'Descripción', tipo: 'texto', requerido: true, sinonimos: ['descripcion', 'detalle', 'producto', 'descripcionarticulo', 'description', 'nombreproducto'], ejemplo: 'Resina PET grado botella' },
  { key: 'cantidad', label: 'Cantidad', tipo: 'numero', requerido: true, sinonimos: ['cantidad', 'cant', 'qty', 'quantity', 'unidades', 'cantidadpedida'], ejemplo: '12000' },
  { key: 'unidad', label: 'Unidad', tipo: 'texto', sinonimos: ['unidad', 'um', 'uom', 'unidadmedida', 'medida'], ejemplo: 'kg' },
  { key: 'precioUnitario', label: 'Precio unitario', tipo: 'numero', sinonimos: ['precio', 'preciounitario', 'costo', 'costounitario', 'unitprice', 'price', 'valorunitario'], ejemplo: '1,32' },
];

export const CAMPOS_POLITICAS: CampoImportacion[] = [
  { key: 'sku', label: 'SKU / código', tipo: 'texto', requerido: true, sinonimos: ['sku', 'codigo', 'codigoproducto', 'item', 'referencia', 'material', 'articulo', 'partnumber'], ejemplo: 'RES-PET-01' },
  { key: 'consumoDiario', label: 'Consumo diario', tipo: 'numero', requerido: true, ayuda: 'Unidades que se consumen por día.', sinonimos: ['consumodiario', 'consumo', 'consumoxdia', 'consumopordia', 'demandadiaria', 'dailyusage', 'consumoprom'], ejemplo: '1500' },
  { key: 'stockSeguridad', label: 'Stock de seguridad', tipo: 'numero', sinonimos: ['stockseguridad', 'seguridad', 'safetystock', 'stockminimo', 'minimo'], ejemplo: '15000' },
  { key: 'leadTimeDias', label: 'Lead time del proveedor (días)', tipo: 'entero', sinonimos: ['leadtime', 'leadtimedias', 'diasreposicion', 'tiempoentrega', 'diasentrega', 'plazoentrega'], ejemplo: '45' },
  { key: 'existenciasExternas', label: 'Existencias (de tu ERP)', tipo: 'numero', ayuda: 'Solo si tu inventario vive en otro sistema (Configuración de la operación).', sinonimos: ['existencias', 'stock', 'stockactual', 'inventario', 'onhand', 'saldo', 'existencia'], ejemplo: '' },
];

export const CAMPOS_POR_TIPO: Record<TipoImportacion, CampoImportacion[]> = {
  ordenes_compra: CAMPOS_OC,
  politicas_inventario: CAMPOS_POLITICAS,
};

// Sin tildes, mayúsculas, espacios ni signos: «N° Pedido» → «npedido».
export const normalizarEncabezado = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

// Sugiere qué columna del archivo corresponde a cada campo de SUTL. Cada
// columna se usa una sola vez (la primera coincidencia gana).
export function sugerirMapeo(encabezados: string[], campos: CampoImportacion[]): Record<string, string> {
  const normalizados = encabezados.map(normalizarEncabezado);
  const usados = new Set<number>();
  const mapeo: Record<string, string> = {};
  for (const campo of campos) {
    const candidatos = [campo.key, campo.label, ...campo.sinonimos].map(normalizarEncabezado);
    const indice = normalizados.findIndex((h, i) => !usados.has(i) && h !== '' && candidatos.includes(h));
    if (indice >= 0) {
      usados.add(indice);
      mapeo[campo.key] = encabezados[indice];
    }
  }
  return mapeo;
}
