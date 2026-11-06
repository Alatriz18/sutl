'use client';

import { ChangeEvent, ReactNode, useEffect, useId, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Download, FileSpreadsheet } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import { cn } from '@/lib/utils';
import { extractApiError, formatNumber } from '@/lib/format';
import { CsvParseado, normalizarFecha, normalizarNumero, parseCsv } from '@/lib/csv';
import { CampoImportacion, sugerirMapeo } from '@/lib/import-campos';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { ImportMappingResponse, TipoImportacion } from '@/types';

export interface ItemResultado {
  id: string;
  titulo: string;
  estado: 'ok' | 'omitida' | 'error';
  mensajes: string[];
}

export interface ResultadoImportacion {
  resumen: { label: string; valor: number; tono?: 'ok' | 'aviso' | 'error' }[];
  items: ItemResultado[];
  // `fila` es la posición en la lista enviada (1 = primera fila de datos).
  errores: { fila: number; numero?: string | null; mensajes: string[] }[];
  // Cuántos elementos se guardarían (o se guardaron) realmente.
  importables: number;
}

interface Props {
  tipo: TipoImportacion;
  campos: CampoImportacion[];
  plantilla: string;
  // Valida (simular = true) o importa de verdad (simular = false).
  evaluar: (filas: Record<string, unknown>[], simular: boolean) => Promise<ResultadoImportacion>;
  // Opciones propias de cada importación (ej. «crear proveedores»); si cambian
  // se invalida la validación anterior.
  opciones?: ReactNode;
  opcionesClave?: string;
  textoImportar: (r: ResultadoImportacion) => string;
  textoExito: (r: ResultadoImportacion) => string;
  destinoHref: string;
  destinoLabel: string;
}

const MAX_FILAS = 5000;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_VISIBLES = 100;
const VISTA_PREVIA = 3;
const TONO: Record<NonNullable<ResultadoImportacion['resumen'][number]['tono']>, string> = {
  ok: 'text-emerald-700',
  aviso: 'text-[#8A5A12]',
  error: 'text-[#B3362B]',
};

// Excel en español suele guardar el CSV en Windows-1252, no en UTF-8: se
// intenta UTF-8 estricto y, si no es válido, se lee como Windows-1252.
async function leerTexto(archivo: File): Promise<string> {
  const buffer = await archivo.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

function aIso(fecha: string) {
  return new Date(`${fecha}T12:00:00`).toISOString();
}

// Convierte el valor de una celda según el tipo del campo. Si no se puede
// interpretar se envía tal cual, para que la API informe el error de esa fila.
function convertir(campo: CampoImportacion, crudo: string): unknown {
  if (campo.tipo === 'numero') return normalizarNumero(crudo) ?? crudo;
  if (campo.tipo === 'entero') {
    const n = normalizarNumero(crudo);
    return n !== null && Number.isInteger(n) ? n : (n ?? crudo);
  }
  if (campo.tipo === 'fecha') {
    const f = normalizarFecha(crudo);
    return f ? aIso(f) : crudo;
  }
  return crudo;
}

function mostrar(campo: CampoImportacion, crudo: string): string {
  if (crudo === '') return '—';
  if (campo.tipo === 'numero' || campo.tipo === 'entero') {
    const n = normalizarNumero(crudo);
    return n === null ? `⚠ «${crudo}»` : formatNumber(n);
  }
  if (campo.tipo === 'fecha') return normalizarFecha(crudo) ?? `⚠ «${crudo}»`;
  return crudo;
}

export function CsvImportWizard({ tipo, campos, plantilla, evaluar, opciones, opcionesClave, textoImportar, textoExito, destinoHref, destinoLabel }: Props) {
  const id = useId();
  const toast = useToast();
  const [archivo, setArchivo] = useState<{ nombre: string; csv: CsvParseado } | null>(null);
  const [mapeo, setMapeo] = useState<Record<string, string>>({});
  const [guardado, setGuardado] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fase, setFase] = useState<'validando' | 'importando' | null>(null);
  const [validacion, setValidacion] = useState<ResultadoImportacion | null>(null);
  const [final, setFinal] = useState<ResultadoImportacion | null>(null);

  // Mapeo que esta empresa usó la última vez (se aplica si el archivo trae esas columnas).
  useEffect(() => {
    api
      .get<ImportMappingResponse>(`/import-mappings/${tipo}`)
      .then((res) => setGuardado(res.data.mapeo))
      .catch(() => setGuardado(null));
  }, [tipo]);

  // Cualquier cambio de archivo, mapeo u opciones invalida la validación hecha.
  useEffect(() => {
    setValidacion(null);
  }, [archivo, mapeo, opcionesClave]);

  async function handleArchivo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setFinal(null);
    if (file.size > MAX_BYTES) {
      setError('El archivo pesa más de 5 MB. Divídelo en partes o quita columnas que no uses.');
      return;
    }
    const csv = parseCsv(await leerTexto(file));
    if (csv.encabezados.length === 0 || csv.filas.length === 0) {
      setError('No encontré datos: el archivo debe tener una fila de encabezados y al menos una fila de datos. Guárdalo como CSV desde Excel.');
      setArchivo(null);
      return;
    }
    if (csv.filas.length > MAX_FILAS) {
      setError(`El archivo tiene ${formatNumber(csv.filas.length)} filas y el máximo por carga es ${formatNumber(MAX_FILAS)}. Divídelo en partes.`);
      setArchivo(null);
      return;
    }
    const sugerido = sugerirMapeo(csv.encabezados, campos);
    const inicial: Record<string, string> = {};
    for (const c of campos) {
      const previo = guardado?.[c.key];
      if (previo && csv.encabezados.includes(previo)) inicial[c.key] = previo;
      else if (sugerido[c.key]) inicial[c.key] = sugerido[c.key];
    }
    setMapeo(inicial);
    setArchivo({ nombre: file.name, csv });
  }

  function descargarPlantilla() {
    const cabecera = campos.map((c) => c.label).join(';');
    const ejemplo = campos.map((c) => c.ejemplo).join(';');
    const blob = new Blob([`﻿${cabecera}\n${ejemplo}\n`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = plantilla;
    a.click();
    URL.revokeObjectURL(url);
  }

  const faltantes = campos.filter((c) => c.requerido && !mapeo[c.key]);

  const construido = useMemo(() => {
    if (!archivo) return null;
    const indices = campos.flatMap((c) => {
      const i = archivo.csv.encabezados.indexOf(mapeo[c.key] ?? '');
      return i >= 0 ? [{ campo: c, i }] : [];
    });
    const filas: Record<string, unknown>[] = [];
    const lineas: number[] = [];
    archivo.csv.filas.forEach((celdas, n) => {
      const fila: Record<string, unknown> = {};
      for (const { campo, i } of indices) {
        const crudo = (celdas[i] ?? '').trim();
        if (crudo !== '') fila[campo.key] = convertir(campo, crudo);
      }
      if (Object.keys(fila).length > 0) {
        filas.push(fila);
        lineas.push(archivo.csv.lineas[n]);
      }
    });
    return { filas, lineas, indices };
  }, [archivo, mapeo, campos]);

  async function ejecutar(simular: boolean) {
    if (!construido) return;
    setFase(simular ? 'validando' : 'importando');
    try {
      const r = await evaluar(construido.filas, simular);
      if (simular) {
        setValidacion(r);
      } else {
        setFinal(r);
        setValidacion(null);
        // Recordar el mapeo de esta empresa para la próxima carga.
        api
          .put(`/import-mappings/${tipo}`, { mapeo: Object.fromEntries(Object.entries(mapeo).filter(([, v]) => v)) })
          .then(() => setGuardado(mapeo))
          .catch(() => undefined);
        toast.success(textoExito(r));
      }
    } catch (err) {
      toast.error(extractApiError(err, simular ? 'No se pudo validar el archivo.' : 'No se pudo importar el archivo.'));
    } finally {
      setFase(null);
    }
  }

  const lineaDe = (fila: number) => construido?.lineas[fila - 1];
  const resultado = final ?? validacion;

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>1. Elige el archivo</CardTitle>
        <p className="mt-1 text-sm text-navy/60">
          Archivo CSV con una fila de encabezados (en Excel: Guardar como → CSV). Detecto solo el separador y los formatos de número y fecha.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label
            htmlFor={`${id}-archivo`}
            className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-navy/20 bg-white px-3 py-2 text-sm font-medium text-navy hover:bg-navy/5 focus-within:ring-2 focus-within:ring-sky"
          >
            <FileSpreadsheet size={16} aria-hidden />
            {archivo ? 'Elegir otro archivo' : 'Elegir archivo CSV'}
            <input id={`${id}-archivo`} type="file" accept=".csv,.txt,text/csv" className="sr-only" onChange={handleArchivo} />
          </label>
          <Button type="button" variant="ghost" onClick={descargarPlantilla}>
            <Download size={14} className="mr-1.5" aria-hidden /> Descargar plantilla
          </Button>
          {archivo && (
            <span className="text-sm text-navy/70">
              <strong className="text-navy">{archivo.nombre}</strong> · {formatNumber(archivo.csv.filas.length)} filas
            </span>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}
      </Card>

      {archivo && (
        <Card>
          <CardTitle>2. Indica qué columna es cada dato</CardTitle>
          <p className="mt-1 text-sm text-navy/60">
            Sugerí las columnas por su nombre{guardado ? ' y usé el mapeo que guardó tu empresa' : ''}. Revisa y corrige lo que haga falta; lo marcado con * es obligatorio.
          </p>
          <div className="-mx-5 mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-y border-navy/5 bg-navy/[0.03] text-navy/60">
                <tr>
                  <th className="px-5 py-2 font-medium">Dato en SUTL</th>
                  <th className="px-3 py-2 font-medium">Columna de tu archivo</th>
                  <th className="px-5 py-2 font-medium">Primera fila</th>
                </tr>
              </thead>
              <tbody>
                {campos.map((c) => {
                  const idx = archivo.csv.encabezados.indexOf(mapeo[c.key] ?? '');
                  return (
                    <tr key={c.key} className="border-b border-navy/5 last:border-0">
                      <td className="px-5 py-2.5">
                        <label htmlFor={`${id}-${c.key}`} className="font-medium text-navy">
                          {c.label}
                          {c.requerido && <span className="text-[#B3362B]"> *</span>}
                        </label>
                        {c.ayuda && <span className="block text-xs text-navy/50">{c.ayuda}</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <select
                          id={`${id}-${c.key}`}
                          value={mapeo[c.key] ?? ''}
                          onChange={(e) => setMapeo((m) => ({ ...m, [c.key]: e.target.value }))}
                          className={cn(
                            'w-full max-w-xs rounded-md border bg-white px-3 py-2 text-sm',
                            c.requerido && !mapeo[c.key] ? 'border-[#B3362B]/60' : 'border-navy/20',
                          )}
                        >
                          <option value="">— No importar —</option>
                          {archivo.csv.encabezados.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-5 py-2.5 text-navy/70">{idx >= 0 ? mostrar(c, archivo.csv.filas[0]?.[idx] ?? '') : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {construido && construido.indices.length > 0 && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-navy/70">Vista previa: cómo voy a leer las primeras filas</summary>
              <div className="-mx-5 mt-2 overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-xs">
                  <thead className="bg-navy/[0.03] text-navy/60">
                    <tr>
                      {construido.indices.map(({ campo }) => (
                        <th key={campo.key} className="px-3 py-1.5 font-medium">
                          {campo.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {archivo.csv.filas.slice(0, VISTA_PREVIA).map((celdas, n) => (
                      <tr key={n} className="border-t border-navy/5">
                        {construido.indices.map(({ campo, i }) => (
                          <td key={campo.key} className="px-3 py-1.5 text-navy/80">
                            {mostrar(campo, celdas[i] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
          {opciones && <div className="mt-4 border-t border-navy/5 pt-3">{opciones}</div>}
        </Card>
      )}

      {archivo && !final && (
        <Card>
          <CardTitle>3. Valida antes de guardar</CardTitle>
          <p className="mt-1 text-sm text-navy/60">La validación no guarda nada: te muestra qué pasaría y qué filas tienen problemas.</p>
          {faltantes.length > 0 && (
            <p className="mt-2 text-sm text-[#B3362B]">Falta mapear: {faltantes.map((c) => c.label).join(', ')}.</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button type="button" disabled={faltantes.length > 0 || !construido?.filas.length || fase !== null} onClick={() => ejecutar(true)}>
              {fase === 'validando' ? 'Validando…' : 'Validar archivo'}
            </Button>
            {validacion && (
              <Button type="button" variant="secondary" disabled={validacion.importables === 0 || fase !== null} onClick={() => ejecutar(false)}>
                {fase === 'importando' ? 'Importando…' : textoImportar(validacion)}
              </Button>
            )}
          </div>
        </Card>
      )}

      {resultado && (
        <Card aria-live="polite">
          <div className="flex items-center gap-2">
            {final && <CheckCircle2 size={18} className="text-emerald-600" aria-hidden />}
            <CardTitle>{final ? 'Importación terminada' : 'Resultado de la validación'}</CardTitle>
          </div>
          {final && (
            <p className="mt-1 text-sm text-navy/70">
              {textoExito(final)}{' '}
              <Link href={destinoHref} className="font-medium text-sky hover:underline">
                {destinoLabel} →
              </Link>
            </p>
          )}
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {resultado.resumen.map((r) => (
              <div key={r.label} className="rounded-lg border border-navy/10 px-3 py-2">
                <dt className="text-xs text-navy/60">{r.label}</dt>
                <dd className={cn('text-2xl font-bold', r.tono ? TONO[r.tono] : 'text-navy')}>{formatNumber(r.valor)}</dd>
              </div>
            ))}
          </dl>

          {resultado.items.length > 0 && (
            <div className="-mx-5 mt-4 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-y border-navy/5 bg-navy/[0.03] text-navy/60">
                  <tr>
                    <th className="px-5 py-2 font-medium">Elemento</th>
                    <th className="px-3 py-2 font-medium">Resultado</th>
                    <th className="px-5 py-2 font-medium">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.items.slice(0, MAX_VISIBLES).map((it) => (
                    <tr key={it.id} className="border-b border-navy/5 last:border-0 align-top">
                      <td className="px-5 py-2.5 font-medium text-navy">{it.titulo}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-semibold',
                            it.estado === 'ok' && 'bg-emerald-100 text-emerald-700',
                            it.estado === 'omitida' && 'bg-gold/15 text-[#8A5A12]',
                            it.estado === 'error' && 'bg-red-100 text-red-700',
                          )}
                        >
                          {it.estado === 'ok' ? (final ? 'Importada' : 'Se importará') : it.estado === 'omitida' ? 'Omitida' : 'Con errores'}
                        </span>
                      </td>
                      <td className="px-5 py-2.5 text-navy/70">{it.mensajes.join(' · ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {resultado.items.length > MAX_VISIBLES && (
                <p className="px-5 pt-2 text-xs text-navy/50">…y {formatNumber(resultado.items.length - MAX_VISIBLES)} más.</p>
              )}
            </div>
          )}

          {resultado.errores.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-navy">Filas con problemas</h4>
              <ul className="mt-1 space-y-1 text-sm">
                {resultado.errores.slice(0, MAX_VISIBLES).map((e) => (
                  <li key={e.fila} className="rounded-md bg-red-50 px-3 py-1.5 text-red-800">
                    <strong>Línea {lineaDe(e.fila) ?? e.fila} del archivo</strong>
                    {e.numero ? ` (${e.numero})` : ''}: {e.mensajes.join(' · ')}
                  </li>
                ))}
              </ul>
              {resultado.errores.length > MAX_VISIBLES && (
                <p className="pt-1 text-xs text-navy/50">…y {formatNumber(resultado.errores.length - MAX_VISIBLES)} más.</p>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
