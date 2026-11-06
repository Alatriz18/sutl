'use client';

import { FormEvent, useCallback, useEffect, useId, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Boxes, HelpCircle, ShieldAlert, TrendingDown, Upload } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { StatTile } from '@/components/ui/stat-tile';
import { useToast } from '@/lib/toast-context';
import { cn } from '@/lib/utils';
import { extractApiError, formatDate, formatNumber } from '@/lib/format';
import { CoberturaResponse, FilaCobertura } from '@/types';

type Filtro = 'todos' | 'riesgo' | 'sin_politica';

interface Edicion {
  sku: string;
  nuevo: boolean;
  policyId: string | null;
  consumoDiario: string;
  stockSeguridad: string;
  leadTimeDias: string;
  existenciasExternas: string;
}

const FILTROS: { value: Filtro; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'riesgo', label: 'En riesgo' },
  { value: 'sin_politica', label: 'Sin parámetros' },
];

const aTexto = (n: number | null | undefined) => (n == null ? '' : String(n));

export default function CoberturaPage() {
  const toast = useToast();
  const formId = useId();
  const [data, setData] = useState<CoberturaResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [confirmarQuitar, setConfirmarQuitar] = useState(false);
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(() => {
    api
      .get<CoberturaResponse>('/inventory-coverage')
      .then((res) => setData(res.data))
      .catch((err) => setError(extractApiError(err, 'No se pudo cargar la cobertura de inventario.')));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const externo = data?.modoInventario === 'nunca';

  const visibles = useMemo(() => {
    if (!data) return [];
    const q = busqueda.trim().toLowerCase();
    return data.filas
      .filter((f) => (filtro === 'riesgo' ? f.bajoSeguridad || f.bajoCobertura : filtro === 'sin_politica' ? f.sinPolitica : true))
      .filter((f) => !q || f.sku.toLowerCase().includes(q) || (f.descripcion ?? '').toLowerCase().includes(q));
  }, [data, filtro, busqueda]);

  function abrirEdicion(f?: FilaCobertura) {
    setConfirmarQuitar(false);
    setEdicion(
      f
        ? {
            sku: f.sku,
            nuevo: false,
            policyId: f.policyId,
            consumoDiario: aTexto(f.consumoDiario),
            stockSeguridad: aTexto(f.stockSeguridad),
            leadTimeDias: aTexto(f.leadTimeDias),
            existenciasExternas: f.stockOrigen === 'externo' ? aTexto(f.stock) : '',
          }
        : { sku: '', nuevo: true, policyId: null, consumoDiario: '', stockSeguridad: '', leadTimeDias: '', existenciasExternas: '' },
    );
  }

  async function handleGuardar(e: FormEvent) {
    e.preventDefault();
    if (!edicion) return;
    setSaving(true);
    try {
      await api.put('/inventory-policies', {
        sku: edicion.sku.trim(),
        consumoDiario: Number(edicion.consumoDiario),
        ...(edicion.stockSeguridad !== '' ? { stockSeguridad: Number(edicion.stockSeguridad) } : {}),
        ...(edicion.leadTimeDias !== '' ? { leadTimeDias: Number(edicion.leadTimeDias) } : {}),
        ...(externo && edicion.existenciasExternas !== '' ? { existenciasExternas: Number(edicion.existenciasExternas) } : {}),
      });
      toast.success('Parámetros guardados.');
      setEdicion(null);
      cargar();
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudieron guardar los parámetros.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleQuitar() {
    if (!edicion?.policyId) return;
    setSaving(true);
    try {
      await api.delete(`/inventory-policies/${edicion.policyId}`);
      toast.success('Parámetros eliminados.');
      setEdicion(null);
      cargar();
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudieron eliminar los parámetros.'));
    } finally {
      setSaving(false);
    }
  }

  if (error && !data) {
    return (
      <div className="rounded-lg border border-navy/10 bg-white p-6 text-center">
        <p className="text-navy/70">{error}</p>
        <Button variant="ghost" className="mt-2" onClick={cargar}>
          Reintentar
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <Skeleton className="h-8 w-72" />
        <Skeleton className="mt-2 h-4 w-96" />
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="mt-6 h-64" />
      </div>
    );
  }

  const mezcladas = data.filas.filter((f) => f.unidadesMezcladas);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Cobertura de inventario</h1>
          <p className="mt-1 text-navy/60">
            Cuántos días alcanza el stock de cada SKU según su consumo. Se marca en riesgo bajo el umbral de tu empresa ({data.umbralDias} días) o por debajo del stock de seguridad.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href="/dashboard/cobertura/importar"
            className="inline-flex items-center gap-1.5 rounded-md border border-navy/20 bg-white px-3 py-2 text-sm font-medium text-navy hover:bg-navy/5"
          >
            <Upload size={14} aria-hidden /> Importar CSV
          </Link>
          <Button onClick={() => abrirEdicion()}>Agregar SKU</Button>
        </div>
      </div>

      {externo && (
        <p className="mt-4 rounded-lg border border-sky/20 bg-sky/5 px-4 py-3 text-sm text-navy/70">
          Tu empresa lleva el inventario en otro sistema: el stock que ves es el que reportas para cada SKU (a mano o importando un CSV), no el de Almacén.
        </p>
      )}
      {mezcladas.length > 0 && (
        <p role="status" className="mt-4 flex items-start gap-2 rounded-lg border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-[#8A5A12]">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          Estos SKUs están en Almacén con unidades distintas y su stock suma cantidades que no son comparables: {mezcladas.map((f) => f.sku).join(', ')}.
        </p>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="SKUs" value={data.resumen.skus} icon={Boxes} accent="navy" hint={`${data.resumen.conPolitica} con parámetros`} />
        <StatTile label="Bajo stock de seguridad" value={data.resumen.bajoSeguridad} icon={ShieldAlert} accent={data.resumen.bajoSeguridad ? 'critical' : 'good'} />
        <StatTile label={`Cobertura < ${data.umbralDias} días`} value={data.resumen.bajoCobertura} icon={TrendingDown} accent={data.resumen.bajoCobertura ? 'warning' : 'good'} />
        <StatTile label="Sin parámetros" value={data.resumen.sinPolitica} icon={HelpCircle} accent="sky" hint="No se puede calcular su cobertura" />
      </div>

      {edicion && (
        <Card className="mt-6">
          <CardTitle>{edicion.nuevo ? 'Agregar parámetros de un SKU' : `Parámetros de ${edicion.sku}`}</CardTitle>
          <form onSubmit={handleGuardar} className="mt-3">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label htmlFor={`${formId}-sku`} className="mb-1 block text-sm font-medium text-navy">
                  SKU
                </label>
                <Input
                  id={`${formId}-sku`}
                  required
                  maxLength={80}
                  disabled={!edicion.nuevo}
                  value={edicion.sku}
                  onChange={(e) => setEdicion({ ...edicion, sku: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor={`${formId}-consumo`} className="mb-1 block text-sm font-medium text-navy">
                  Consumo diario
                </label>
                <Input
                  id={`${formId}-consumo`}
                  type="number"
                  required
                  min="0"
                  step="any"
                  value={edicion.consumoDiario}
                  onChange={(e) => setEdicion({ ...edicion, consumoDiario: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor={`${formId}-seg`} className="mb-1 block text-sm font-medium text-navy">
                  Stock de seguridad
                </label>
                <Input
                  id={`${formId}-seg`}
                  type="number"
                  min="0"
                  step="any"
                  value={edicion.stockSeguridad}
                  onChange={(e) => setEdicion({ ...edicion, stockSeguridad: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor={`${formId}-lead`} className="mb-1 block text-sm font-medium text-navy">
                  Lead time del proveedor (días)
                </label>
                <Input
                  id={`${formId}-lead`}
                  type="number"
                  min="0"
                  max="365"
                  step="1"
                  value={edicion.leadTimeDias}
                  onChange={(e) => setEdicion({ ...edicion, leadTimeDias: e.target.value })}
                />
              </div>
              {externo && (
                <div>
                  <label htmlFor={`${formId}-ext`} className="mb-1 block text-sm font-medium text-navy">
                    Existencias (de tu ERP)
                  </label>
                  <Input
                    id={`${formId}-ext`}
                    type="number"
                    min="0"
                    step="any"
                    value={edicion.existenciasExternas}
                    onChange={(e) => setEdicion({ ...edicion, existenciasExternas: e.target.value })}
                  />
                </div>
              )}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={saving}>
                Guardar
              </Button>
              <Button type="button" variant="ghost" onClick={() => setEdicion(null)}>
                Cancelar
              </Button>
              {edicion.policyId &&
                (confirmarQuitar ? (
                  <span className="ml-auto flex items-center gap-2 text-sm text-red-700">
                    ¿Eliminar los parámetros de este SKU?
                    <Button type="button" variant="danger" disabled={saving} onClick={handleQuitar}>
                      Sí, eliminar
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setConfirmarQuitar(false)}>
                      No
                    </Button>
                  </span>
                ) : (
                  <button type="button" className="ml-auto text-xs font-medium text-red-600 hover:underline" onClick={() => setConfirmarQuitar(true)}>
                    Quitar parámetros
                  </button>
                ))}
            </div>
          </form>
        </Card>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar SKUs">
          {FILTROS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filtro === f.value}
              onClick={() => setFiltro(f.value)}
              className={cn(
                'rounded-full border px-3 py-1 text-sm font-medium transition-colors',
                filtro === f.value ? 'border-navy bg-navy text-white' : 'border-navy/15 bg-white text-navy/70 hover:bg-navy/5',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Input
          aria-label="Buscar por SKU o descripción"
          placeholder="Buscar SKU o descripción"
          className="sm:max-w-xs"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {data.filas.length === 0 ? (
        <Card className="mt-4 text-center">
          <p className="text-navy/70">Todavía no hay SKUs. Aparecen al registrar inventario en Almacén, al crear OCs o al definir sus parámetros aquí.</p>
          <Link href="/dashboard/almacen" className="mt-2 inline-block text-sm text-sky hover:underline">
            Ir a Almacén →
          </Link>
        </Card>
      ) : (
        // relative: el texto sr-only de la tabla es absoluto y, sin esto, el scroll del contenedor no lo recorta y estira toda la página.
        <div className="relative mt-4 overflow-x-auto rounded-xl border border-navy/[0.07] bg-white">
          <table className="w-full min-w-[860px] text-left text-sm">
            <caption className="sr-only">Cobertura de inventario por SKU</caption>
            <thead className="border-b border-navy/5 bg-navy/[0.03] text-navy/60">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">SKU</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Stock</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Consumo/día</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Seguridad</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Cobertura</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">En camino</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Próxima llegada</th>
                <th scope="col" className="px-4 py-2.5"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((f) => {
                const riesgo = f.bajoSeguridad || f.bajoCobertura;
                return (
                  <tr key={f.sku} className="border-b border-navy/5 last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-navy">{f.sku}</p>
                      {f.descripcion && <p className="text-xs text-navy/50">{f.descripcion}</p>}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {f.stock == null ? <span className="text-navy/40">sin dato</span> : formatNumber(f.stock)}
                      {f.unidad && f.stock != null && <span className="text-navy/40"> {f.unidad}</span>}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-navy/70">{f.consumoDiario == null ? '—' : formatNumber(f.consumoDiario)}</td>
                    <td className={cn('px-3 py-3 text-right tabular-nums', f.bajoSeguridad ? 'font-semibold text-[#B3362B]' : 'text-navy/70')}>
                      {f.stockSeguridad == null ? '—' : formatNumber(f.stockSeguridad)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {f.sinPolitica ? (
                        <span className="rounded-full bg-sky/10 px-2 py-0.5 text-xs font-semibold text-sky">Sin parámetros</span>
                      ) : f.diasCobertura == null ? (
                        <span className="text-navy/40">—</span>
                      ) : (
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
                            riesgo ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700',
                          )}
                        >
                          {formatNumber(f.diasCobertura)} días{f.bajoSeguridad ? ' · bajo seguridad' : ''}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-navy/70">
                      {f.enCamino > 0 ? formatNumber(f.enCamino) : '—'}
                      {f.pendienteOc > f.enCamino && (
                        <span className="block text-xs text-navy/40">{formatNumber(f.pendienteOc - f.enCamino)} sin embarcar</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-navy/70">{f.proximaEta ? formatDate(f.proximaEta) : '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="text-sm font-medium text-sky hover:underline"
                        onClick={() => abrirEdicion(f)}
                        aria-label={`${f.sinPolitica ? 'Definir parámetros de' : 'Editar parámetros de'} ${f.sku}`}
                      >
                        {f.sinPolitica ? 'Definir' : 'Editar'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {visibles.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-navy/50">
                    Ningún SKU coincide con el filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
