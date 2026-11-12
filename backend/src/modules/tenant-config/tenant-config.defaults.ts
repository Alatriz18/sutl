// Configuración de la operación por tenant. Cada industria (y cada empresa,
// según venga de un ERP propio o no) trabaja distinto, así que las reglas de
// negocio que varían entre clientes se leen de aquí en vez de estar fijas.
//
// Modelo: perfil de industria (valores sugeridos) + solo los ajustes que el
// tenant cambió encima. Así un ajuste nuevo que se agregue a futuro toma el
// valor sugerido del perfil sin migrar datos.

export const MODOS_RECEPCION_INVENTARIO = ['automatico', 'a_eleccion', 'nunca'] as const;
export type ModoRecepcionInventario = (typeof MODOS_RECEPCION_INVENTARIO)[number];

export interface ConfigOperacion {
  compras: {
    // % que se acepta recibir por encima de lo pedido en cada línea
    // (ej. resinas a granel suelen llegar ±5%).
    toleranciaSobreRecepcionPct: number;
    // Días antes de la fecha requerida en que una OC sin confirmar se marca en ámbar.
    diasAlertaAnticipada: number;
    // Si confirmar una OC exige la fecha comprometida por el proveedor.
    exigirFechaConfirmacion: boolean;
    // Si vincular un embarque a una OC confirmada la marca como despachada
    // (el proveedor ya entregó la carga al transportista).
    vincularEmbarqueDespachaOc: boolean;
  };
  inventario: {
    // automatico: cada recepción de OC suma al inventario de SUTL (exige bodega).
    // a_eleccion: quien registra la recepción decide si suma o no.
    // nunca: el inventario vive en otro sistema (ERP/WMS del cliente).
    recepcionActualizaInventario: ModoRecepcionInventario;
    // Días de cobertura por debajo de los cuales un SKU se marca en riesgo.
    diasCoberturaAlerta: number;
  };
  riesgo: {
    // Si el motor de riesgo avisa por correo a los administradores cuando un SKU pasa a rojo.
    avisarAlPasarARojo: boolean;
  };
}

export interface PerfilOperacion {
  nombre: string;
  descripcion: string;
  config: ConfigOperacion;
}

export const PERFILES = {
  general: {
    nombre: 'General',
    descripcion: 'Reglas estrictas por defecto: se recibe exactamente lo pedido y cada recepción decide si entra al inventario.',
    config: {
      compras: { toleranciaSobreRecepcionPct: 0, diasAlertaAnticipada: 7, exigirFechaConfirmacion: true, vincularEmbarqueDespachaOc: false },
      inventario: { recepcionActualizaInventario: 'a_eleccion', diasCoberturaAlerta: 15 },
      riesgo: { avisarAlPasarARojo: true },
    },
  },
  manufactura: {
    nombre: 'Manufactura',
    descripcion: 'Materia prima a granel con variación de peso, planificación con más anticipación y recepción directa a bodega.',
    config: {
      compras: { toleranciaSobreRecepcionPct: 5, diasAlertaAnticipada: 14, exigirFechaConfirmacion: true, vincularEmbarqueDespachaOc: true },
      inventario: { recepcionActualizaInventario: 'automatico', diasCoberturaAlerta: 30 },
      riesgo: { avisarAlPasarARojo: true },
    },
  },
  comercio: {
    nombre: 'Comercio y distribución',
    descripcion: 'Producto terminado por unidad: se recibe exactamente lo pedido y entra directo al inventario.',
    config: {
      compras: { toleranciaSobreRecepcionPct: 0, diasAlertaAnticipada: 7, exigirFechaConfirmacion: true, vincularEmbarqueDespachaOc: true },
      inventario: { recepcionActualizaInventario: 'automatico', diasCoberturaAlerta: 20 },
      riesgo: { avisarAlPasarARojo: true },
    },
  },
  erp_externo: {
    nombre: 'Inventario en ERP propio',
    descripcion: 'La empresa lleva su inventario en su propio ERP o WMS: SUTL controla las OCs y su llegada, pero no mueve stock.',
    config: {
      compras: { toleranciaSobreRecepcionPct: 0, diasAlertaAnticipada: 7, exigirFechaConfirmacion: true, vincularEmbarqueDespachaOc: false },
      inventario: { recepcionActualizaInventario: 'nunca', diasCoberturaAlerta: 15 },
      riesgo: { avisarAlPasarARojo: true },
    },
  },
} satisfies Record<string, PerfilOperacion>;

export type PerfilId = keyof typeof PERFILES;
export const PERFIL_IDS = Object.keys(PERFILES) as PerfilId[];
export const PERFIL_POR_DEFECTO: PerfilId = 'general';

// Ajustes guardados por el tenant: subconjunto parcial de ConfigOperacion.
export type AjustesOperacion = {
  [S in keyof ConfigOperacion]?: Partial<ConfigOperacion[S]>;
};

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// Lee de forma defensiva lo guardado en la columna JSON: descarta claves
// desconocidas y valores con tipo incorrecto (nunca confía en el JSON tal cual).
export function sanitizarAjustes(raw: unknown): AjustesOperacion {
  const base = PERFILES[PERFIL_POR_DEFECTO].config;
  const resultado: AjustesOperacion = {};
  if (!esObjeto(raw)) return resultado;

  for (const seccion of Object.keys(base) as (keyof ConfigOperacion)[]) {
    const valores = raw[seccion];
    if (!esObjeto(valores)) continue;
    const limpio: Record<string, unknown> = {};
    for (const [clave, porDefecto] of Object.entries(base[seccion])) {
      const valor = valores[clave];
      if (valor === undefined || typeof valor !== typeof porDefecto) continue;
      if (clave === 'recepcionActualizaInventario' && !MODOS_RECEPCION_INVENTARIO.includes(valor as ModoRecepcionInventario)) {
        continue;
      }
      limpio[clave] = valor;
    }
    if (Object.keys(limpio).length > 0) {
      (resultado as Record<string, unknown>)[seccion] = limpio;
    }
  }
  return resultado;
}

export function esPerfilValido(perfil: string): perfil is PerfilId {
  return Object.prototype.hasOwnProperty.call(PERFILES, perfil);
}

// Configuración efectiva = valores del perfil + ajustes del tenant.
export function resolverConfig(perfil: string, ajustes: unknown): ConfigOperacion {
  const base = PERFILES[esPerfilValido(perfil) ? perfil : PERFIL_POR_DEFECTO].config;
  const limpio = sanitizarAjustes(ajustes);
  return {
    compras: { ...base.compras, ...limpio.compras },
    inventario: { ...base.inventario, ...limpio.inventario },
    riesgo: { ...base.riesgo, ...limpio.riesgo },
  };
}

// Combina los ajustes existentes con los nuevos (los nuevos ganan).
export function combinarAjustes(actuales: AjustesOperacion, nuevos: AjustesOperacion): AjustesOperacion {
  return sanitizarAjustes({
    compras: { ...actuales.compras, ...nuevos.compras },
    inventario: { ...actuales.inventario, ...nuevos.inventario },
    riesgo: { ...actuales.riesgo, ...nuevos.riesgo },
  });
}
