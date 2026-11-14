import { AccionRiesgo } from '@/types';

// Textos de la acción recomendada por el motor de riesgo (los usan la pantalla
// de riesgo y el tablero de la torre de control).
export const ACCION_RIESGO: Record<AccionRiesgo, string> = {
  adelantar_proveedor: 'Urgir al proveedor que despache ya',
  partir_envio: 'Partir el embarque y adelantar una parte',
  compra_urgente: 'Comprar ya (compra urgente)',
  confirmar_fecha: 'Confirmar la fecha real de llegada',
  planificar_compra: 'Planificar la compra',
  ninguna: '—',
};
