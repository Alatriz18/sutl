// Modo demo del abastecimiento: vínculo OC ↔ embarque, cobertura de inventario,
// políticas por SKU, importaciones y mapeos. Reproduce las reglas del backend
// real (backend/src/modules/purchase-orders, inventory-coverage, import-mappings)
// para que la demo en línea se comporte igual, incluidos los mensajes de error.
import { CoberturaResponse, FilaCobertura, FilaRiesgo, InventoryPolicy, PurchaseOrder, PurchaseOrderLine, RiesgoResponse, TipoImportacion } from '@/types';
import { CAMPOS_POR_TIPO } from '../import-campos';
import { INCOTERMS } from '../purchase-orders';
import * as db from './data';
import { MockApiError } from './errors';
import { Reposicion, evaluarRiesgo } from './risk-engine';
import { configEfectivaDemo } from './tenant-config';

const ESTADOS_VINCULO = ['emitida', 'confirmada', 'despachada', 'recibida_parcial'];
const EPS = 1e-9;
const r4 = (n: number) => Math.round(n * 10000) / 10000;
const nowIso = () => new Date().toISOString();
const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const maxDecimales = (n: number, d: number) => Math.abs(n * 10 ** d - Math.round(n * 10 ** d)) < 1e-6;

function buscarOc(id: string): PurchaseOrder {
  const oc = db.purchaseOrders.find((o) => o.id === id);
  if (!oc) throw new MockApiError(404, 'Orden de compra no encontrada');
  return oc;
}

// ---------- Vínculo OC ↔ embarque ----------

export function vincularEmbarque(ocId: string, body: Record<string, unknown>) {
  const oc = buscarOc(ocId);
  if (!ESTADOS_VINCULO.includes(oc.estado)) {
    throw new MockApiError(400, `No se puede vincular un embarque a una OC ${oc.estado} (debe estar emitida, confirmada o despachada)`);
  }
  const shipmentId = String(body.shipmentId ?? '');
  const envio = db.shipments.find((s) => s.id === shipmentId);
  if (!envio) throw new MockApiError(404, 'Envío no encontrado');
  if (envio.estado === 'entregado') throw new MockApiError(400, 'El embarque ya fue entregado y no admite más carga');

  const items = Array.isArray(body.lineas) ? (body.lineas as { lineaId?: string; cantidad?: unknown }[]) : [];
  if (items.length === 0) throw new MockApiError(400, 'lineas must contain at least 1 elements');
  const vistos = new Set<string>();
  for (const it of items) {
    if (!oc.lineas.some((l) => l.id === it.lineaId)) throw new MockApiError(400, `La línea ${it.lineaId} no pertenece a esta OC`);
    if (vistos.has(it.lineaId!)) throw new MockApiError(400, `La línea ${it.lineaId} está repetida en la solicitud`);
    vistos.add(it.lineaId!);
    if (typeof it.cantidad !== 'number' || it.cantidad < 0 || !maxDecimales(it.cantidad, 4)) {
      throw new MockApiError(400, 'cantidad must be a number (máx. 4 decimales) no menor que 0');
    }
  }

  const cfg = configEfectivaDemo();
  const factor = 1 + cfg.compras.toleranciaSobreRecepcionPct / 100;
  // Validar todo antes de aplicar nada (mismo comportamiento transaccional que el backend).
  for (const it of items) {
    const linea = oc.lineas.find((l) => l.id === it.lineaId)!;
    const otros = db.shipmentOcLinks.filter((k) => k.lineaId === linea.id && k.shipmentId !== shipmentId).reduce((s, k) => s + k.cantidad, 0);
    if (otros + (it.cantidad as number) > linea.cantidad * factor + EPS) {
      const disponible = Math.max(linea.cantidad * factor - otros, 0);
      throw new MockApiError(400, `La asignación de ${linea.sku} excede lo pedido: ya hay ${otros} en otros embarques y solo quedan ${r4(disponible)} por asignar`);
    }
  }
  for (const it of items) {
    const cantidad = it.cantidad as number;
    const idx = db.shipmentOcLinks.findIndex((k) => k.lineaId === it.lineaId && k.shipmentId === shipmentId);
    if (cantidad === 0) {
      if (idx >= 0) db.shipmentOcLinks.splice(idx, 1);
    } else if (idx >= 0) {
      db.shipmentOcLinks[idx].cantidad = cantidad;
    } else {
      db.shipmentOcLinks.push({ id: db.nextId('lk'), shipmentId, lineaId: it.lineaId!, cantidad });
    }
  }
  if (cfg.compras.vincularEmbarqueDespachaOc && oc.estado === 'confirmada' && db.shipmentOcLinks.some((k) => oc.lineas.some((l) => l.id === k.lineaId))) {
    oc.estado = 'despachada';
    oc.fechaDespacho = nowIso();
  }
  oc.updatedAt = nowIso();
  return db.purchaseOrderExpanded(oc);
}

export function desvincularEmbarque(ocId: string, shipmentId: string) {
  const oc = buscarOc(ocId);
  let quitados = 0;
  for (let i = db.shipmentOcLinks.length - 1; i >= 0; i--) {
    const k = db.shipmentOcLinks[i];
    if (k.shipmentId === shipmentId && oc.lineas.some((l) => l.id === k.lineaId)) {
      db.shipmentOcLinks.splice(i, 1);
      quitados++;
    }
  }
  if (quitados === 0) throw new MockApiError(404, 'Ese embarque no tiene carga de esta OC');
  return db.purchaseOrderExpanded(oc);
}

// ---------- Cobertura de inventario ----------

export function cobertura(): CoberturaResponse {
  const cfg = configEfectivaDemo();
  const externo = cfg.inventario.recepcionActualizaInventario === 'nunca';
  const umbral = cfg.inventario.diasCoberturaAlerta;
  type Acum = { descripcion: string | null; unidad: string | null; unidades: Set<string>; stockSutl: number; pendienteOc: number; enCamino: number; proximaEta: string | null };
  const porSku = new Map<string, Acum>();
  const acum = (sku: string) => {
    let a = porSku.get(sku);
    if (!a) {
      a = { descripcion: null, unidad: null, unidades: new Set(), stockSutl: 0, pendienteOc: 0, enCamino: 0, proximaEta: null };
      porSku.set(sku, a);
    }
    return a;
  };
  for (const it of db.inventoryItems) {
    if (!it.sku) continue;
    const a = acum(it.sku);
    a.stockSutl += it.cantidad;
    a.descripcion ??= it.descripcion;
    a.unidad ??= it.unidad;
    a.unidades.add(it.unidad);
  }
  for (const oc of db.purchaseOrders.filter((o) => ESTADOS_VINCULO.includes(o.estado))) {
    for (const l of oc.lineas) {
      const a = acum(l.sku);
      const pendiente = Math.max(l.cantidad - l.cantidadRecibida, 0);
      const enRuta = db.shipmentOcLinks
        .filter((k) => k.lineaId === l.id)
        .flatMap((k) => {
          const s = db.shipments.find((x) => x.id === k.shipmentId);
          return s && s.estado !== 'entregado' ? [{ cantidad: k.cantidad, eta: s.fechaEstimadaLlegada }] : [];
        });
      a.pendienteOc += pendiente;
      a.enCamino += Math.min(enRuta.reduce((s, e) => s + e.cantidad, 0), pendiente);
      for (const e of enRuta) if (e.eta && (!a.proximaEta || e.eta < a.proximaEta)) a.proximaEta = e.eta;
      a.descripcion ??= l.descripcion;
      a.unidad ??= l.unidad;
    }
  }
  for (const p of db.inventoryPolicies) acum(p.sku);

  const filas: FilaCobertura[] = [...porSku.entries()].map(([sku, a]) => {
    const p = db.inventoryPolicies.find((x) => x.sku === sku) ?? null;
    const stock = externo ? (p?.existenciasExternas ?? null) : a.stockSutl;
    const consumo = p?.consumoDiario ?? null;
    const dias = stock != null && consumo != null && consumo > 0 ? Math.round((stock / consumo) * 10) / 10 : null;
    return {
      sku, descripcion: a.descripcion, unidad: a.unidad, stock, stockOrigen: externo ? 'externo' : 'sutl',
      consumoDiario: consumo, stockSeguridad: p?.stockSeguridad ?? null, leadTimeDias: p?.leadTimeDias ?? null,
      diasCobertura: dias,
      bajoSeguridad: !!p && p.stockSeguridad > 0 && stock != null && stock < p.stockSeguridad,
      bajoCobertura: dias != null && dias < umbral,
      sinPolitica: !p, unidadesMezcladas: a.unidades.size > 1,
      pendienteOc: r4(a.pendienteOc), enCamino: r4(a.enCamino), proximaEta: a.proximaEta,
      policyId: p?.id ?? null, existenciasExternasAt: p?.existenciasExternasAt ?? null,
    };
  });
  const riesgo = (f: FilaCobertura) => (f.bajoSeguridad || f.bajoCobertura ? 0 : 1);
  filas.sort((x, y) => riesgo(x) - riesgo(y) || (x.diasCobertura ?? Infinity) - (y.diasCobertura ?? Infinity) || x.sku.localeCompare(y.sku));
  return {
    umbralDias: umbral,
    modoInventario: cfg.inventario.recepcionActualizaInventario,
    resumen: {
      skus: filas.length,
      conPolitica: filas.filter((f) => !f.sinPolitica).length,
      sinPolitica: filas.filter((f) => f.sinPolitica).length,
      bajoSeguridad: filas.filter((f) => f.bajoSeguridad).length,
      bajoCobertura: filas.filter((f) => f.bajoCobertura).length,
    },
    filas,
  };
}

// ---------- Riesgo de abastecimiento ----------

const ORDEN_SEMAFORO = { rojo: 0, amarillo: 1, verde: 2, sin_datos: 3 } as const;

export function riesgo(): RiesgoResponse {
  const cob = cobertura();
  const hoy = new Date();
  const porSku = new Map<string, Reposicion[]>();
  const agregar = (sku: string, r: Reposicion) => porSku.set(sku, [...(porSku.get(sku) ?? []), r]);
  for (const oc of db.purchaseOrders.filter((o) => ESTADOS_VINCULO.includes(o.estado))) {
    for (const l of oc.lineas) {
      let pendiente = Math.max(l.cantidad - l.cantidadRecibida, 0);
      for (const k of db.shipmentOcLinks.filter((x) => x.lineaId === l.id)) {
        const s = db.shipments.find((x) => x.id === k.shipmentId);
        if (!s || s.estado === 'entregado') continue;
        const cantidad = Math.min(k.cantidad, pendiente);
        if (cantidad <= 0) continue;
        pendiente -= cantidad;
        agregar(l.sku, { fecha: s.fechaEstimadaLlegada ? new Date(s.fechaEstimadaLlegada) : null, cantidad, origen: 'embarque', referencia: s.codigoGuia });
      }
      if (pendiente > 0) agregar(l.sku, { fecha: null, cantidad: pendiente, origen: 'oc', referencia: oc.numero });
    }
  }
  const filas: FilaRiesgo[] = cob.filas.map((f) => {
    const reposiciones = porSku.get(f.sku) ?? [];
    const r = f.sinPolitica
      ? { semaforo: 'sin_datos' as const, accion: 'ninguna' as const, motivo: 'Este SKU no tiene política de inventario (consumo diario y stock de seguridad).', fechaQuiebre: null, diasSinStock: 0, cubiertoHasta: null, fechaBajoSeguridad: null, reposicionesSinFecha: 0, reposicionesVencidas: 0 }
      : evaluarRiesgo({ hoy, stock: f.stock, consumoDiario: f.consumoDiario, stockSeguridad: f.stockSeguridad ?? 0, leadTimeDias: f.leadTimeDias, diasCoberturaAlerta: cob.umbralDias, reposiciones });
    const iso = (d: Date | null) => (d ? d.toISOString() : null);
    return {
      sku: f.sku, descripcion: f.descripcion, unidad: f.unidad, stock: f.stock, consumoDiario: f.consumoDiario,
      diasCobertura: f.diasCobertura, stockSeguridad: f.stockSeguridad, leadTimeDias: f.leadTimeDias,
      semaforo: r.semaforo, accion: r.accion, motivo: r.motivo, diasSinStock: r.diasSinStock,
      fechaQuiebre: iso(r.fechaQuiebre), cubiertoHasta: iso(r.cubiertoHasta), fechaBajoSeguridad: iso(r.fechaBajoSeguridad),
      reposicionesSinFecha: r.reposicionesSinFecha, reposicionesVencidas: r.reposicionesVencidas,
      reposiciones: reposiciones.map((x) => ({ origen: x.origen, referencia: x.referencia, cantidad: x.cantidad, fecha: iso(x.fecha) })),
    };
  });
  filas.sort(
    (a, b) =>
      ORDEN_SEMAFORO[a.semaforo] - ORDEN_SEMAFORO[b.semaforo] ||
      (a.fechaQuiebre ? Date.parse(a.fechaQuiebre) : Infinity) - (b.fechaQuiebre ? Date.parse(b.fechaQuiebre) : Infinity) ||
      a.sku.localeCompare(b.sku),
  );
  const cuenta = (s: FilaRiesgo['semaforo']) => filas.filter((f) => f.semaforo === s).length;
  const acciones: RiesgoResponse['resumen']['acciones'] = {};
  for (const f of filas) if (f.accion !== 'ninguna') acciones[f.accion] = (acciones[f.accion] ?? 0) + 1;
  return { evaluadoAt: hoy.toISOString(), umbralDias: cob.umbralDias, resumen: { rojo: cuenta('rojo'), amarillo: cuenta('amarillo'), verde: cuenta('verde'), sinDatos: cuenta('sin_datos'), acciones }, filas };
}

// ---------- Políticas por SKU ----------

const CAMPOS_POLITICA = ['sku', 'consumoDiario', 'stockSeguridad', 'leadTimeDias', 'existenciasExternas'];

function validarPolitica(plano: unknown): { valor?: Record<string, unknown>; errores: string[] } {
  if (!esObjeto(plano)) return { errores: ['La fila no es un objeto válido'] };
  const e: string[] = [];
  for (const k of Object.keys(plano)) if (!CAMPOS_POLITICA.includes(k)) e.push(`property ${k} should not exist`);
  if (typeof plano.sku !== 'string' || plano.sku === '') e.push('sku should not be empty');
  else if (plano.sku.length > 80) e.push('sku must be shorter than or equal to 80 characters');
  const num = (campo: string, obligatorio: boolean) => {
    const v = plano[campo];
    if (v === undefined) {
      if (obligatorio) e.push(`${campo} must be a number conforming to the specified constraints`);
      return;
    }
    if (typeof v !== 'number' || !Number.isFinite(v) || !maxDecimales(v, 4)) e.push(`${campo} must be a number conforming to the specified constraints`);
    else if (v < 0) e.push(`${campo} must not be less than 0`);
  };
  num('consumoDiario', true);
  num('stockSeguridad', false);
  num('existenciasExternas', false);
  const lead = plano.leadTimeDias;
  if (lead !== undefined && (typeof lead !== 'number' || !Number.isInteger(lead))) e.push('leadTimeDias must be an integer number');
  else if (typeof lead === 'number' && (lead < 0 || lead > 365)) e.push('leadTimeDias must not be greater than 365');
  if (plano.existenciasExternas !== undefined && configEfectivaDemo().inventario.recepcionActualizaInventario !== 'nunca') {
    e.push('Tu empresa lleva el inventario en SUTL: las existencias se calculan desde Almacén. Las existencias externas solo aplican si configuras que el inventario vive en otro sistema');
  }
  return e.length ? { errores: e } : { valor: plano, errores: [] };
}

function aplicarPolitica(v: Record<string, unknown>) {
  const sku = String(v.sku).trim();
  const previa = db.inventoryPolicies.find((p) => p.sku === sku);
  const datos: Partial<InventoryPolicy> = {
    consumoDiario: v.consumoDiario as number,
    stockSeguridad: (v.stockSeguridad as number | undefined) ?? 0,
    leadTimeDias: (v.leadTimeDias as number | undefined) ?? null,
    ...(v.existenciasExternas !== undefined ? { existenciasExternas: v.existenciasExternas as number, existenciasExternasAt: nowIso() } : {}),
  };
  if (previa) return Object.assign(previa, datos);
  const nueva: InventoryPolicy = { id: db.nextId('pol'), sku, existenciasExternas: null, existenciasExternasAt: null, ...(datos as Omit<InventoryPolicy, 'id' | 'sku' | 'existenciasExternas' | 'existenciasExternasAt'>) };
  db.inventoryPolicies.push(nueva);
  return nueva;
}

export const listarPoliticas = () => [...db.inventoryPolicies].sort((a, b) => a.sku.localeCompare(b.sku));

export function guardarPolitica(body: Record<string, unknown>) {
  const { valor, errores } = validarPolitica(body);
  if (!valor) throw new MockApiError(400, errores.join(', '));
  if (String(valor.sku).trim() === '') throw new MockApiError(400, 'El SKU no puede estar vacío');
  return aplicarPolitica(valor);
}

export function eliminarPolitica(id: string) {
  const i = db.inventoryPolicies.findIndex((p) => p.id === id);
  if (i < 0) throw new MockApiError(404, 'Política de SKU no encontrada');
  db.inventoryPolicies.splice(i, 1);
  return { id };
}

export function importarPoliticas(body: Record<string, unknown>) {
  const filas = body.filas;
  if (!Array.isArray(filas) || filas.length > 5000 || !filas.every(esObjeto)) {
    throw new MockApiError(400, 'filas debe ser una lista de hasta 5000 objetos');
  }
  const simular = body.simular === true;
  const vistos = new Map<string, number>();
  const resultado: { fila: number; sku: string | null; estado: 'ok' | 'error'; mensajes: string[] }[] = [];
  const validas: Record<string, unknown>[] = [];
  filas.forEach((plana, i) => {
    const fila = i + 1;
    const { valor, errores } = validarPolitica(plana);
    const mensajes = [...errores];
    const sku = typeof (plana as { sku?: unknown }).sku === 'string' ? (plana as { sku: string }).sku.trim() || null : null;
    if (valor) {
      if (!sku) mensajes.push('El SKU no puede estar vacío');
      else if (vistos.has(sku)) mensajes.push(`SKU repetido en el archivo (ya aparece en la fila ${vistos.get(sku)})`);
      else vistos.set(sku, fila);
    }
    if (mensajes.length > 0 || !valor) resultado.push({ fila, sku, estado: 'error', mensajes });
    else {
      resultado.push({ fila, sku, estado: 'ok', mensajes: [] });
      validas.push(valor);
    }
  });
  if (!simular) validas.forEach(aplicarPolitica);
  return {
    simular,
    resumen: { total: filas.length, aplicadas: simular ? 0 : validas.length, validas: validas.length, conErrores: resultado.length - validas.length },
    filas: resultado,
  };
}

// ---------- Mapeo de columnas por empresa ----------

function assertTipo(tipo: string): TipoImportacion {
  if (!(tipo in CAMPOS_POR_TIPO)) throw new MockApiError(400, `Tipo de importación desconocido; usa: ${Object.keys(CAMPOS_POR_TIPO).join(', ')}`);
  return tipo as TipoImportacion;
}

function limpiarMapeo(tipo: TipoImportacion, crudo: unknown) {
  const salida: Record<string, string> = {};
  if (!esObjeto(crudo)) return salida;
  for (const c of CAMPOS_POR_TIPO[tipo]) {
    const v = crudo[c.key];
    if (typeof v === 'string' && v.trim() !== '' && v.length <= 120) salida[c.key] = v.trim();
  }
  return salida;
}

export function obtenerMapeo(tipo: string) {
  const t = assertTipo(tipo);
  const m = db.importMappings[t];
  return { tipo: t, mapeo: m ? limpiarMapeo(t, m) : null };
}

export function guardarMapeo(tipo: string, body: Record<string, unknown>) {
  const t = assertTipo(tipo);
  if (!esObjeto(body.mapeo)) throw new MockApiError(400, 'mapeo must be an object');
  const limpio = limpiarMapeo(t, body.mapeo);
  db.importMappings[t] = limpio;
  return { tipo: t, mapeo: limpio };
}

// ---------- Importación de OCs ----------

const CAMPOS_FILA_OC = CAMPOS_POR_TIPO.ordenes_compra.map((c) => c.key);
const CABECERA = ['proveedor', 'proveedorTaxId', 'incoterm', 'moneda', 'fechaEmision', 'fechaRequerida', 'fechaConfirmadaProveedor', 'notas'] as const;
const norm = (s: unknown) => (typeof s === 'string' ? s.trim().toLowerCase() : '');

function validarFilaOc(plano: unknown): { valor?: Record<string, unknown>; errores: string[] } {
  if (!esObjeto(plano)) return { errores: ['La fila no es un objeto válido'] };
  const e: string[] = [];
  for (const k of Object.keys(plano)) if (!CAMPOS_FILA_OC.includes(k)) e.push(`property ${k} should not exist`);
  const texto = (campo: string, max: number, obligatorio: boolean) => {
    const v = plano[campo];
    if (v === undefined) {
      if (obligatorio) e.push(`${campo} should not be empty`);
      return;
    }
    if (typeof v !== 'string') e.push(`${campo} must be a string`);
    else if (obligatorio && v === '') e.push(`${campo} should not be empty`);
    else if (v.length > max) e.push(`${campo} must be shorter than or equal to ${max} characters`);
  };
  texto('numero', 60, true); texto('proveedor', 200, false); texto('proveedorTaxId', 40, false); texto('notas', 2000, false);
  texto('sku', 80, true); texto('descripcion', 300, true); texto('unidad', 30, false);
  if (plano.incoterm !== undefined && !(INCOTERMS as readonly string[]).includes(String(plano.incoterm))) {
    e.push(`incoterm must be one of the following values: ${INCOTERMS.join(', ')}`);
  }
  if (plano.moneda !== undefined && (typeof plano.moneda !== 'string' || plano.moneda.length !== 3)) e.push('moneda must be longer than or equal to 3 and shorter than or equal to 3 characters');
  for (const f of ['fechaEmision', 'fechaRequerida', 'fechaConfirmadaProveedor']) {
    const v = plano[f];
    if (v !== undefined && (typeof v !== 'string' || Number.isNaN(Date.parse(v)))) e.push(`${f} must be a valid ISO 8601 date string`);
  }
  const c = plano.cantidad;
  if (typeof c !== 'number' || !Number.isFinite(c) || !maxDecimales(c, 4)) e.push('cantidad must be a number conforming to the specified constraints');
  else if (c <= 0) e.push('cantidad must be a positive number');
  const p = plano.precioUnitario;
  if (p !== undefined && (typeof p !== 'number' || !Number.isFinite(p))) e.push('precioUnitario must be a number conforming to the specified constraints');
  else if (typeof p === 'number' && p < 0) e.push('precioUnitario must not be less than 0');
  return e.length ? { errores: e } : { valor: plano, errores: [] };
}

type FilaOc = { fila: number; dto: Record<string, unknown> };

export function importarOcs(body: Record<string, unknown>, tenantId: string, userId: string | null) {
  const filas = body.filas;
  if (!Array.isArray(filas) || filas.length > 5000 || !filas.every(esObjeto)) {
    throw new MockApiError(400, 'filas debe ser una lista de hasta 5000 objetos');
  }
  const simular = body.simular === true;
  const crearProveedores = body.crearProveedores === true;
  const errores: { fila: number; numero: string | null; mensajes: string[] }[] = [];
  const grupos = new Map<string, FilaOc[]>();
  const numerosConError = new Set<string>();

  filas.forEach((plana, i) => {
    const fila = i + 1;
    const { valor, errores: mensajes } = validarFilaOc(plana);
    const crudo = typeof plana.numero === 'string' ? plana.numero.trim() : null;
    if (!valor) {
      errores.push({ fila, numero: crudo || null, mensajes });
      if (crudo) numerosConError.add(crudo);
      return;
    }
    const numero = String(valor.numero).trim();
    if (!numero) {
      errores.push({ fila, numero: null, mensajes: ['El N° de OC no puede estar vacío'] });
      return;
    }
    valor.numero = numero;
    grupos.set(numero, [...(grupos.get(numero) ?? []), { fila, dto: valor }]);
  });

  const proveedores = db.partners.filter((p) => p.tipo === 'proveedor' && p.activo);
  const resultados: { numero: string; estado: 'nueva' | 'omitida' | 'error'; lineas: number; proveedor: string | null; mensajes: string[] }[] = [];
  const aCrear: { numero: string; proveedorId: string | null; nuevo: { nombre: string; taxId: string | null } | null; filas: FilaOc[] }[] = [];
  const nuevos = new Map<string, { nombre: string; taxId: string | null }>();

  for (const numero of numerosConError) {
    if (!grupos.has(numero)) resultados.push({ numero, estado: 'error', lineas: 0, proveedor: null, mensajes: ['Tiene filas con errores; la OC no se importa a medias'] });
  }
  for (const [numero, lista] of grupos) {
    const mensajes: string[] = [];
    if (numerosConError.has(numero)) mensajes.push('Otra fila de esta OC tiene errores; la OC no se importa a medias');
    if (lista.length > 500) mensajes.push(`La OC tiene ${lista.length} líneas y el máximo es 500`);
    const valores = (campo: (typeof CABECERA)[number]) =>
      lista.map((f) => f.dto[campo]).filter((v) => v !== undefined && v !== '');
    for (const campo of CABECERA) {
      const distintos = new Set(valores(campo).map((v) => (campo === 'moneda' ? String(v).toUpperCase() : String(v).trim())));
      if (distintos.size > 1) mensajes.push(`El campo «${campo}» trae valores distintos entre las filas de la OC`);
    }
    const cab = (campo: (typeof CABECERA)[number]) => valores(campo)[0] as string | undefined;
    let proveedorId: string | null = null;
    let nuevo: { nombre: string; taxId: string | null } | null = null;
    let etiqueta: string | null = cab('proveedor') ?? cab('proveedorTaxId') ?? null;
    if (!cab('proveedor') && !cab('proveedorTaxId')) {
      mensajes.push('Falta el proveedor (nombre o RUC/Tax ID)');
    } else {
      const porRuc = cab('proveedorTaxId') ? proveedores.filter((p) => norm(p.taxId) === norm(cab('proveedorTaxId'))) : [];
      const porNombre = cab('proveedor') ? proveedores.filter((p) => norm(p.nombre) === norm(cab('proveedor'))) : [];
      const candidatos = porRuc.length > 0 ? porRuc : porNombre;
      if (candidatos.length === 1) {
        proveedorId = candidatos[0].id;
        etiqueta = candidatos[0].nombre;
      } else if (candidatos.length > 1) {
        mensajes.push(`Hay ${candidatos.length} proveedores con ese ${porRuc.length ? 'RUC' : 'nombre'}; indica el RUC/Tax ID para elegir uno`);
      } else if (crearProveedores && cab('proveedor')) {
        nuevo = { nombre: cab('proveedor')!.trim(), taxId: cab('proveedorTaxId')?.trim() || null };
      } else {
        mensajes.push(`Proveedor no encontrado: «${etiqueta}». Créalo en Contactos o activa «crear proveedores que no existan»`);
      }
    }
    const existente = db.purchaseOrders.find((o) => o.numero === numero);
    if (mensajes.length > 0) resultados.push({ numero, estado: 'error', lineas: lista.length, proveedor: etiqueta, mensajes });
    else if (existente) resultados.push({ numero, estado: 'omitida', lineas: lista.length, proveedor: etiqueta, mensajes: [`Ya existe en tu empresa (${existente.estado}); no se modifica`] });
    else {
      resultados.push({ numero, estado: 'nueva', lineas: lista.length, proveedor: etiqueta, mensajes: nuevo ? [`Se creará el proveedor «${nuevo.nombre}»`] : [] });
      aCrear.push({ numero, proveedorId, nuevo, filas: lista });
      if (nuevo) {
        const clave = norm(nuevo.taxId) || norm(nuevo.nombre);
        if (!nuevos.has(clave)) nuevos.set(clave, nuevo);
      }
    }
  }

  if (!simular) {
    const ids = new Map<string, string>();
    for (const [clave, p] of nuevos) {
      const partner = { id: db.nextId('p'), tenantId, tipo: 'proveedor' as const, nombre: p.nombre, taxId: p.taxId, email: null, telefono: null, direccion: null, contactoNombre: null, activo: true, createdAt: nowIso(), updatedAt: nowIso() };
      db.partners.push(partner);
      ids.set(clave, partner.id);
    }
    for (const oc of aCrear) {
      const proveedorId = oc.proveedorId ?? ids.get(norm(oc.nuevo?.taxId) || norm(oc.nuevo?.nombre))!;
      const primero = (campo: (typeof CABECERA)[number]) => oc.filas.map((f) => f.dto[campo]).find((v) => v !== undefined && v !== '') as string | undefined;
      const id = db.nextId('oc');
      db.purchaseOrders.push({
        id, tenantId, numero: oc.numero, proveedorId, estado: 'borrador', incoterm: primero('incoterm') ?? null,
        moneda: (primero('moneda') ?? 'USD').toUpperCase(), fechaEmision: primero('fechaEmision') ?? nowIso(),
        fechaRequerida: primero('fechaRequerida') ?? null, fechaConfirmadaProveedor: primero('fechaConfirmadaProveedor') ?? null,
        fechaDespacho: null, motivoCancelacion: null, notas: primero('notas') ?? null, creadoPorId: userId,
        lineas: oc.filas.map(({ dto: l }): PurchaseOrderLine => ({
          id: db.nextId('ocl'), tenantId, purchaseOrderId: id, sku: String(l.sku).trim(), descripcion: String(l.descripcion),
          cantidad: l.cantidad as number, unidad: (l.unidad as string) || 'unidad',
          precioUnitario: typeof l.precioUnitario === 'number' ? l.precioUnitario : null, cantidadRecibida: 0, recepciones: [],
          createdAt: nowIso(), updatedAt: nowIso(),
        })),
        createdAt: nowIso(), updatedAt: nowIso(),
      });
    }
  }

  return {
    simular,
    resumen: {
      filas: filas.length,
      ordenes: resultados.length,
      nuevas: resultados.filter((r) => r.estado === 'nueva').length,
      omitidas: resultados.filter((r) => r.estado === 'omitida').length,
      conErrores: resultados.filter((r) => r.estado === 'error').length,
      filasConErrores: errores.length,
      proveedoresACrear: nuevos.size,
    },
    ordenes: resultados,
    errores,
  };
}
