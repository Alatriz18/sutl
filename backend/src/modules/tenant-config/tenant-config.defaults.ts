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
    // Días de tránsito que se suman a la fecha de despacho de una OC que todavía no tiene embarque, para estimar cuándo
    // llegaría (0 = no estimar: la OC sigue «sin fecha de llegada»).
    diasTransitoEstimado: number;
  };
  excepciones: {
    // Horas para atender una excepción grave (SKU en rojo, OC muy atrasada) antes de escalarla.
    slaAltaHoras: number;
    // Horas para atender una excepción moderada (OC atrasada) antes de escalarla.
    slaMediaHoras: number;
    // Si cada excepción nueva abre una tarea automáticamente.
    crearTareas: boolean;
    // A quién se le asigna la tarea según el tipo de excepción (id de un usuario interno; vacío = sin responsable).
    responsableSkuRojoId: string;
    responsableOcAtrasadaId: string;
    responsableDocumentoFaltanteId: string;
  };
  documentos: {
    // Documentos que cada envío debe tener antes de llegar (los sube y aprueba el equipo).
    exigirFactura: boolean;
    exigirPackingList: boolean;
    // BL (marítimo) o AWB (aéreo); el terrestre no lo necesita.
    exigirDocumentoTransporte: boolean;
    // Solo en importaciones: el pedimento o declaración aduanera.
    exigirPedimento: boolean;
    // Días antes del vencimiento de un documento en que se marca «por vencer».
    diasAvisoVencimiento: number;
    // Cuántos días antes de la llegada estimada un documento faltante abre una excepción.
    diasAntesEtaFaltante: number;
    // Si SUTL escribe a los administradores cuando un documento está por vencer o ya venció (una sola vez por documento).
    avisarVencimientos: boolean;
  };
  // Metas con las que la analítica colorea el OTIF (verde / ámbar / rojo). Cada empresa exige distinto a sus proveedores.
  analitica: {
    // % de OTIF desde el cual el resultado se considera bueno (verde).
    metaOtifPct: number;
    // % de OTIF desde el cual se considera «en atención» (ámbar); por debajo es crítico (rojo). Nunca mayor que la meta.
    umbralAtencionOtifPct: number;
  };
  seguridad: {
    // Si todos los administradores de la empresa deben activar el segundo factor (app de autenticación) para usar el sistema.
    exigirMfaAdministradores: boolean;
  };
  // Cómo se ve la página pública de seguimiento que recibe el destinatario (cada campo vacío = por defecto).
  marca: {
    nombreComercial: string;
    // Color de acento en formato #RRGGBB.
    colorPrimario: string;
    // Dirección https de la imagen del logo.
    logoUrl: string;
    mensaje: string;
    // Si se muestra «Con tecnología de SUTL» al pie.
    mostrarSutl: boolean;
  };
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const COLOR_MARCA = /^#[0-9a-fA-F]{6}$/;
export const LOGO_MARCA = /^https:\/\/[^\s"'<>]{1,280}$/;

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
      riesgo: { avisarAlPasarARojo: true, diasTransitoEstimado: 0 },
      excepciones: { slaAltaHoras: 24, slaMediaHoras: 72, crearTareas: true, responsableSkuRojoId: '', responsableOcAtrasadaId: '', responsableDocumentoFaltanteId: '' },
      documentos: { exigirFactura: true, exigirPackingList: true, exigirDocumentoTransporte: true, exigirPedimento: false, diasAvisoVencimiento: 15, diasAntesEtaFaltante: 5, avisarVencimientos: true },
      analitica: { metaOtifPct: 90, umbralAtencionOtifPct: 70 },
      seguridad: { exigirMfaAdministradores: false },
      marca: { nombreComercial: '', colorPrimario: '', logoUrl: '', mensaje: '', mostrarSutl: true },
    },
  },
  manufactura: {
    nombre: 'Manufactura',
    descripcion: 'Materia prima a granel con variación de peso, planificación con más anticipación y recepción directa a bodega.',
    config: {
      compras: { toleranciaSobreRecepcionPct: 5, diasAlertaAnticipada: 14, exigirFechaConfirmacion: true, vincularEmbarqueDespachaOc: true },
      inventario: { recepcionActualizaInventario: 'automatico', diasCoberturaAlerta: 30 },
      riesgo: { avisarAlPasarARojo: true, diasTransitoEstimado: 0 },
      excepciones: { slaAltaHoras: 24, slaMediaHoras: 72, crearTareas: true, responsableSkuRojoId: '', responsableOcAtrasadaId: '', responsableDocumentoFaltanteId: '' },
      documentos: { exigirFactura: true, exigirPackingList: true, exigirDocumentoTransporte: true, exigirPedimento: true, diasAvisoVencimiento: 15, diasAntesEtaFaltante: 5, avisarVencimientos: true },
      analitica: { metaOtifPct: 90, umbralAtencionOtifPct: 70 },
      seguridad: { exigirMfaAdministradores: false },
      marca: { nombreComercial: '', colorPrimario: '', logoUrl: '', mensaje: '', mostrarSutl: true },
    },
  },
  comercio: {
    nombre: 'Comercio y distribución',
    descripcion: 'Producto terminado por unidad: se recibe exactamente lo pedido y entra directo al inventario.',
    config: {
      compras: { toleranciaSobreRecepcionPct: 0, diasAlertaAnticipada: 7, exigirFechaConfirmacion: true, vincularEmbarqueDespachaOc: true },
      inventario: { recepcionActualizaInventario: 'automatico', diasCoberturaAlerta: 20 },
      riesgo: { avisarAlPasarARojo: true, diasTransitoEstimado: 0 },
      excepciones: { slaAltaHoras: 24, slaMediaHoras: 72, crearTareas: true, responsableSkuRojoId: '', responsableOcAtrasadaId: '', responsableDocumentoFaltanteId: '' },
      documentos: { exigirFactura: true, exigirPackingList: true, exigirDocumentoTransporte: true, exigirPedimento: true, diasAvisoVencimiento: 15, diasAntesEtaFaltante: 5, avisarVencimientos: true },
      analitica: { metaOtifPct: 90, umbralAtencionOtifPct: 70 },
      seguridad: { exigirMfaAdministradores: false },
      marca: { nombreComercial: '', colorPrimario: '', logoUrl: '', mensaje: '', mostrarSutl: true },
    },
  },
  erp_externo: {
    nombre: 'Inventario en ERP propio',
    descripcion: 'La empresa lleva su inventario en su propio ERP o WMS: SUTL controla las OCs y su llegada, pero no mueve stock.',
    config: {
      compras: { toleranciaSobreRecepcionPct: 0, diasAlertaAnticipada: 7, exigirFechaConfirmacion: true, vincularEmbarqueDespachaOc: false },
      inventario: { recepcionActualizaInventario: 'nunca', diasCoberturaAlerta: 15 },
      riesgo: { avisarAlPasarARojo: true, diasTransitoEstimado: 0 },
      excepciones: { slaAltaHoras: 24, slaMediaHoras: 72, crearTareas: true, responsableSkuRojoId: '', responsableOcAtrasadaId: '', responsableDocumentoFaltanteId: '' },
      documentos: { exigirFactura: true, exigirPackingList: true, exigirDocumentoTransporte: true, exigirPedimento: false, diasAvisoVencimiento: 15, diasAntesEtaFaltante: 5, avisarVencimientos: true },
      analitica: { metaOtifPct: 90, umbralAtencionOtifPct: 70 },
      seguridad: { exigirMfaAdministradores: false },
      marca: { nombreComercial: '', colorPrimario: '', logoUrl: '', mensaje: '', mostrarSutl: true },
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
      // Un responsable es el identificador de un usuario (UUID) o vacío; el servidor además comprueba que sea de la empresa.
      if (seccion === 'excepciones' && clave.startsWith('responsable') && valor !== '' && !UUID.test(valor as string)) continue;
      if (seccion === 'riesgo' && clave === 'diasTransitoEstimado' && (!Number.isInteger(valor) || (valor as number) < 0 || (valor as number) > 365)) continue;
      if (seccion === 'analitica' && (!Number.isFinite(valor) || (valor as number) < 1 || (valor as number) > 100)) continue;
      // La marca se muestra a terceros: un color o logo mal formado se descarta al leer.
      if (seccion === 'marca') {
        if (clave === 'colorPrimario' && valor !== '' && !COLOR_MARCA.test(valor as string)) continue;
        if (clave === 'logoUrl' && valor !== '' && !LOGO_MARCA.test(valor as string)) continue;
        if ((clave === 'nombreComercial' || clave === 'mensaje') && (valor as string).length > (clave === 'mensaje' ? 280 : 60)) continue;
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
    excepciones: { ...base.excepciones, ...limpio.excepciones },
    documentos: { ...base.documentos, ...limpio.documentos },
    analitica: { ...base.analitica, ...limpio.analitica },
    seguridad: { ...base.seguridad, ...limpio.seguridad },
    marca: { ...base.marca, ...limpio.marca },
  };
}

// Combina los ajustes existentes con los nuevos (los nuevos ganan).
export function combinarAjustes(actuales: AjustesOperacion, nuevos: AjustesOperacion): AjustesOperacion {
  return sanitizarAjustes({
    compras: { ...actuales.compras, ...nuevos.compras },
    inventario: { ...actuales.inventario, ...nuevos.inventario },
    riesgo: { ...actuales.riesgo, ...nuevos.riesgo },
    excepciones: { ...actuales.excepciones, ...nuevos.excepciones },
    documentos: { ...actuales.documentos, ...nuevos.documentos },
    analitica: { ...actuales.analitica, ...nuevos.analitica },
    seguridad: { ...actuales.seguridad, ...nuevos.seguridad },
    marca: { ...actuales.marca, ...nuevos.marca },
  });
}
