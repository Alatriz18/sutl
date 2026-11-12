import { AjustesOperacion, ConfigOperacion, PerfilOperacion, TenantConfigResponse } from '@/types';

// Copia para el modo demo de los perfiles de backend/src/modules/tenant-config
// (tenant-config.defaults.ts). En modo real la UI usa lo que devuelve la API.
export const PERFILES_DEMO: PerfilOperacion[] = [
  {
    id: 'general',
    nombre: 'General',
    descripcion: 'Reglas estrictas por defecto: se recibe exactamente lo pedido y cada recepción decide si entra al inventario.',
    config: {
      compras: { toleranciaSobreRecepcionPct: 0, diasAlertaAnticipada: 7, exigirFechaConfirmacion: true, vincularEmbarqueDespachaOc: false },
      inventario: { recepcionActualizaInventario: 'a_eleccion', diasCoberturaAlerta: 15 },
      riesgo: { avisarAlPasarARojo: true },
    },
  },
  {
    id: 'manufactura',
    nombre: 'Manufactura',
    descripcion: 'Materia prima a granel con variación de peso, planificación con más anticipación y recepción directa a bodega.',
    config: {
      compras: { toleranciaSobreRecepcionPct: 5, diasAlertaAnticipada: 14, exigirFechaConfirmacion: true, vincularEmbarqueDespachaOc: true },
      inventario: { recepcionActualizaInventario: 'automatico', diasCoberturaAlerta: 30 },
      riesgo: { avisarAlPasarARojo: true },
    },
  },
  {
    id: 'comercio',
    nombre: 'Comercio y distribución',
    descripcion: 'Producto terminado por unidad: se recibe exactamente lo pedido y entra directo al inventario.',
    config: {
      compras: { toleranciaSobreRecepcionPct: 0, diasAlertaAnticipada: 7, exigirFechaConfirmacion: true, vincularEmbarqueDespachaOc: true },
      inventario: { recepcionActualizaInventario: 'automatico', diasCoberturaAlerta: 20 },
      riesgo: { avisarAlPasarARojo: true },
    },
  },
  {
    id: 'erp_externo',
    nombre: 'Inventario en ERP propio',
    descripcion: 'La empresa lleva su inventario en su propio ERP o WMS: SUTL controla las OCs y su llegada, pero no mueve stock.',
    config: {
      compras: { toleranciaSobreRecepcionPct: 0, diasAlertaAnticipada: 7, exigirFechaConfirmacion: true, vincularEmbarqueDespachaOc: false },
      inventario: { recepcionActualizaInventario: 'nunca', diasCoberturaAlerta: 15 },
      riesgo: { avisarAlPasarARojo: true },
    },
  },
];

const estado: { perfil: string; ajustes: AjustesOperacion } = { perfil: 'general', ajustes: {} };

function efectiva(): ConfigOperacion {
  const base = (PERFILES_DEMO.find((p) => p.id === estado.perfil) ?? PERFILES_DEMO[0]).config;
  return {
    compras: { ...base.compras, ...estado.ajustes.compras },
    inventario: { ...base.inventario, ...estado.ajustes.inventario },
    riesgo: { ...base.riesgo, ...estado.ajustes.riesgo },
  };
}

export function configDemo(): TenantConfigResponse {
  return { perfil: estado.perfil, configuracion: efectiva(), ajustes: estado.ajustes, perfiles: PERFILES_DEMO };
}

export function configEfectivaDemo(): ConfigOperacion {
  return efectiva();
}

// Mismas reglas que TenantConfigService.update en el backend.
export function actualizarConfigDemo(body: {
  perfil?: string;
  restablecer?: boolean;
  configuracion?: AjustesOperacion;
}): string | null {
  if (body.perfil !== undefined && !PERFILES_DEMO.some((p) => p.id === body.perfil)) {
    return 'perfil must be one of the following values: ' + PERFILES_DEMO.map((p) => p.id).join(', ');
  }
  const c = body.configuracion?.compras;
  if (c?.toleranciaSobreRecepcionPct !== undefined && (c.toleranciaSobreRecepcionPct < 0 || c.toleranciaSobreRecepcionPct > 50)) {
    return 'La tolerancia debe estar entre 0 y 50%';
  }
  if (c?.diasAlertaAnticipada !== undefined && (!Number.isInteger(c.diasAlertaAnticipada) || c.diasAlertaAnticipada < 1 || c.diasAlertaAnticipada > 90)) {
    return 'Los días de alerta deben ser un entero entre 1 y 90';
  }
  const inv = body.configuracion?.inventario;
  if (inv?.diasCoberturaAlerta !== undefined && (!Number.isInteger(inv.diasCoberturaAlerta) || inv.diasCoberturaAlerta < 1 || inv.diasCoberturaAlerta > 365)) {
    return 'Los días de cobertura deben ser un entero entre 1 y 365';
  }
  const cambiaPerfil = body.perfil !== undefined && body.perfil !== estado.perfil;
  const base = cambiaPerfil || body.restablecer ? {} : estado.ajustes;
  estado.perfil = body.perfil ?? estado.perfil;
  const ajustes: AjustesOperacion = {};
  const compras = { ...base.compras, ...body.configuracion?.compras };
  const inventario = { ...base.inventario, ...body.configuracion?.inventario };
  if (Object.keys(compras).length) ajustes.compras = compras;
  if (Object.keys(inventario).length) ajustes.inventario = inventario;
  const riesgo = { ...base.riesgo, ...body.configuracion?.riesgo };
  if (Object.keys(riesgo).length) ajustes.riesgo = riesgo;
  estado.ajustes = ajustes;
  return null;
}
