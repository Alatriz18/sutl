'use client';

import { FormEvent, useEffect, useId, useMemo, useState } from 'react';
import { Check, Info } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { cn } from '@/lib/utils';
import { extractApiError, formatNumber } from '@/lib/format';
import { MODO_RECEPCION_LABELS, publicarTenantConfig, useTenantConfig } from '@/lib/tenant-config';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { AjustesOperacion, ConfigOperacion, ModoRecepcionInventario, TenantConfigResponse } from '@/types';

const MODOS: ModoRecepcionInventario[] = ['automatico', 'a_eleccion', 'nunca'];

// Solo los valores que difieren del perfil: eso es lo que se guarda como
// ajuste propio de la empresa.
function diferencias(form: ConfigOperacion, perfil: ConfigOperacion): AjustesOperacion {
  const ajustes: AjustesOperacion = {};
  for (const seccion of Object.keys(perfil) as (keyof ConfigOperacion)[]) {
    const distintos = Object.fromEntries(
      Object.entries(form[seccion]).filter(
        ([clave, valor]) => (perfil[seccion] as Record<string, unknown>)[clave] !== valor,
      ),
    );
    if (Object.keys(distintos).length > 0) {
      (ajustes as Record<string, unknown>)[seccion] = distintos;
    }
  }
  return ajustes;
}

export default function ConfiguracionPage() {
  const { user } = useAuth();
  const toast = useToast();
  const id = useId();
  const { data, error, recargar } = useTenantConfig();
  const [form, setForm] = useState<ConfigOperacion | null>(null);
  const [perfilPendiente, setPerfilPendiente] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const puedeEditar = user?.rol === 'admin_tenant' || user?.rol === 'super_admin';

  useEffect(() => {
    if (data) setForm(structuredClone(data.configuracion));
  }, [data]);

  const perfilActual = data?.perfiles.find((p) => p.id === data.perfil);
  const sinGuardar = useMemo(
    () => !!data && !!form && JSON.stringify(form) !== JSON.stringify(data.configuracion),
    [data, form],
  );

  async function guardar(body: Record<string, unknown>, exito: string) {
    setBusy(true);
    try {
      const res = await api.patch<TenantConfigResponse>('/tenant-config', body);
      publicarTenantConfig(res.data);
      toast.success(exito);
      return true;
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo guardar la configuración.'));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleGuardar(e: FormEvent) {
    e.preventDefault();
    if (!form || !perfilActual) return;
    await guardar(
      { restablecer: true, configuracion: diferencias(form, perfilActual.config) },
      'Configuración guardada.',
    );
  }

  async function aplicarPerfil(perfil: string) {
    const okPerfil = await guardar({ perfil }, 'Perfil aplicado con sus valores sugeridos.');
    if (okPerfil) setPerfilPendiente(null);
  }

  if (error && !data) {
    return (
      <div className="rounded-lg border border-navy/10 bg-white p-6 text-center">
        <p className="text-navy/70">No se pudo cargar la configuración de tu empresa.</p>
        <Button variant="ghost" className="mt-2" onClick={() => recargar().catch(() => undefined)}>
          Reintentar
        </Button>
      </div>
    );
  }

  if (!data || !form || !perfilActual) {
    return (
      <div>
        <Skeleton className="h-8 w-80" />
        <Skeleton className="mt-2 h-4 w-96" />
        <Skeleton className="mt-6 h-48" />
        <Skeleton className="mt-6 h-64" />
      </div>
    );
  }

  const sugerido = perfilActual.config;
  const ajustado = (seccion: keyof ConfigOperacion, clave: string) =>
    (form[seccion] as Record<string, unknown>)[clave] !== (sugerido[seccion] as Record<string, unknown>)[clave];
  const set = <S extends keyof ConfigOperacion>(seccion: S, valores: Partial<ConfigOperacion[S]>) =>
    setForm((f) => (f ? { ...f, [seccion]: { ...f[seccion], ...valores } } : f));

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-navy">Configuración de la operación</h1>
      <p className="mt-1 text-navy/60">
        Cada empresa trabaja distinto. Elige el perfil que más se parece a la tuya y ajusta lo que necesites: SUTL
        aplica estas reglas en compras, recepciones e inventario.
      </p>

      {!puedeEditar && (
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-sky/20 bg-sky/5 px-4 py-3 text-sm text-navy/70">
          <Info size={16} className="mt-0.5 shrink-0 text-sky" aria-hidden />
          Solo un administrador de tu empresa puede cambiar esta configuración.
        </p>
      )}

      <Card className="mt-6">
        <CardTitle>Perfil de tu empresa</CardTitle>
        <p className="mt-1 text-sm text-navy/60">
          El perfil trae valores sugeridos. Cambiarlo reemplaza tus ajustes por los del nuevo perfil.
        </p>
        <fieldset className="mt-4">
          <legend className="sr-only">Perfil de la operación</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {data.perfiles.map((p) => {
              const activo = p.id === data.perfil;
              const elegido = perfilPendiente === p.id;
              return (
                <label
                  key={p.id}
                  className={cn(
                    'relative flex cursor-pointer flex-col rounded-lg border p-4 text-sm transition-colors',
                    activo ? 'border-sky bg-sky/5' : elegido ? 'border-navy/40' : 'border-navy/10 hover:border-navy/25',
                    !puedeEditar && 'cursor-default',
                  )}
                >
                  <input
                    type="radio"
                    name={`${id}-perfil`}
                    value={p.id}
                    className="sr-only"
                    checked={elegido || (activo && !perfilPendiente)}
                    disabled={!puedeEditar || busy}
                    onChange={() => setPerfilPendiente(activo ? null : p.id)}
                  />
                  <span className="flex items-center justify-between gap-2 font-semibold text-navy">
                    {p.nombre}
                    {activo && (
                      <span className="flex items-center gap-1 text-xs font-medium text-sky">
                        <Check size={14} aria-hidden /> Actual
                      </span>
                    )}
                  </span>
                  <span className="mt-1 text-navy/60">{p.descripcion}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
        {perfilPendiente && (
          <div
            role="alert"
            className="mt-4 flex flex-col gap-3 rounded-lg border border-gold/40 bg-gold/10 p-4 text-sm text-[#8A5A12] sm:flex-row sm:items-center sm:justify-between"
          >
            <span>
              Vas a aplicar el perfil{' '}
              <strong>{data.perfiles.find((p) => p.id === perfilPendiente)?.nombre}</strong>. Tus ajustes actuales se
              reemplazarán por sus valores sugeridos{sinGuardar ? ' y perderás los cambios sin guardar' : ''}.
            </span>
            <div className="flex shrink-0 gap-2">
              <Button disabled={busy} onClick={() => aplicarPerfil(perfilPendiente)}>
                Aplicar perfil
              </Button>
              <Button variant="ghost" onClick={() => setPerfilPendiente(null)}>
                Volver
              </Button>
            </div>
          </div>
        )}
      </Card>

      <form onSubmit={handleGuardar}>
        <Card className="mt-6">
          <CardTitle>Compras</CardTitle>
          <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Campo
              htmlFor={`${id}-tol`}
              label="Tolerancia de sobre-recepción"
              ayuda="Cuánto más de lo pedido se acepta recibir en cada línea (ej. materia prima a granel)."
              sugerido={`${formatNumber(sugerido.compras.toleranciaSobreRecepcionPct)}%`}
              ajustado={ajustado('compras', 'toleranciaSobreRecepcionPct')}
            >
              <div className="flex items-center gap-2">
                <Input
                  id={`${id}-tol`}
                  type="number"
                  min={0}
                  max={50}
                  step={0.5}
                  required
                  disabled={!puedeEditar}
                  className="w-28"
                  value={Number.isNaN(form.compras.toleranciaSobreRecepcionPct) ? '' : form.compras.toleranciaSobreRecepcionPct}
                  onChange={(e) => set('compras', { toleranciaSobreRecepcionPct: e.target.valueAsNumber })}
                />
                <span className="text-sm text-navy/60">%</span>
              </div>
            </Campo>
            <Campo
              htmlFor={`${id}-dias`}
              label="Alerta anticipada"
              ayuda="Días antes de la fecha requerida en que una OC sin confirmar se marca en ámbar."
              sugerido={`${sugerido.compras.diasAlertaAnticipada} días`}
              ajustado={ajustado('compras', 'diasAlertaAnticipada')}
            >
              <div className="flex items-center gap-2">
                <Input
                  id={`${id}-dias`}
                  type="number"
                  min={1}
                  max={90}
                  step={1}
                  required
                  disabled={!puedeEditar}
                  className="w-28"
                  value={Number.isNaN(form.compras.diasAlertaAnticipada) ? '' : form.compras.diasAlertaAnticipada}
                  onChange={(e) => set('compras', { diasAlertaAnticipada: e.target.valueAsNumber })}
                />
                <span className="text-sm text-navy/60">días</span>
              </div>
            </Campo>
            <div className="sm:col-span-2">
              <Campo
                label="Confirmación del proveedor"
                sugerido={sugerido.compras.exigirFechaConfirmacion ? 'exigir fecha' : 'fecha opcional'}
                ajustado={ajustado('compras', 'exigirFechaConfirmacion')}
              >
                <label className="flex items-start gap-2 text-sm text-navy">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-navy/30 text-sky focus:ring-sky"
                    disabled={!puedeEditar}
                    checked={form.compras.exigirFechaConfirmacion}
                    onChange={(e) => set('compras', { exigirFechaConfirmacion: e.target.checked })}
                  />
                  <span>
                    Exigir la fecha de despacho comprometida para confirmar una OC
                    <span className="block text-xs text-navy/50">
                      Desactívalo si tus proveedores confirman sin fecha y la registras después.
                    </span>
                  </span>
                </label>
              </Campo>
            </div>
            <div className="sm:col-span-2">
              <Campo
                label="Embarque vinculado"
                sugerido={sugerido.compras.vincularEmbarqueDespachaOc ? 'marca la OC despachada' : 'no cambia la OC'}
                ajustado={ajustado('compras', 'vincularEmbarqueDespachaOc')}
              >
                <label className="flex items-start gap-2 text-sm text-navy">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-navy/30 text-sky focus:ring-sky"
                    disabled={!puedeEditar}
                    checked={form.compras.vincularEmbarqueDespachaOc}
                    onChange={(e) => set('compras', { vincularEmbarqueDespachaOc: e.target.checked })}
                  />
                  <span>
                    Al vincular un embarque a una OC confirmada, marcarla como despachada
                    <span className="block text-xs text-navy/50">
                      Úsalo si cargar un embarque significa que el proveedor ya entregó la carga al transportista.
                    </span>
                  </span>
                </label>
              </Campo>
            </div>
          </div>
        </Card>

        <Card className="mt-6">
          <CardTitle>Inventario</CardTitle>
          <fieldset className="mt-3">
            <legend className="flex flex-wrap items-center gap-2 text-sm font-medium text-navy">
              ¿Las recepciones de OC actualizan el inventario de SUTL?
              <EtiquetaAjuste
                sugerido={MODO_RECEPCION_LABELS[sugerido.inventario.recepcionActualizaInventario].titulo}
                ajustado={ajustado('inventario', 'recepcionActualizaInventario')}
              />
            </legend>
            <div className="mt-3 flex flex-col gap-2">
              {MODOS.map((modo) => (
                <label
                  key={modo}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm',
                    form.inventario.recepcionActualizaInventario === modo ? 'border-sky bg-sky/5' : 'border-navy/10',
                    !puedeEditar && 'cursor-default',
                  )}
                >
                  <input
                    type="radio"
                    name={`${id}-modo`}
                    className="mt-0.5 h-4 w-4 border-navy/30 text-sky focus:ring-sky"
                    disabled={!puedeEditar}
                    checked={form.inventario.recepcionActualizaInventario === modo}
                    onChange={() => set('inventario', { recepcionActualizaInventario: modo })}
                  />
                  <span>
                    <span className="font-medium text-navy">{MODO_RECEPCION_LABELS[modo].titulo}</span>
                    <span className="block text-navy/60">{MODO_RECEPCION_LABELS[modo].descripcion}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-5 max-w-sm">
            <Campo
              htmlFor={`${id}-cobertura`}
              label="Alerta de cobertura de inventario"
              ayuda="Un SKU se marca en riesgo cuando sus días de cobertura bajan de este número."
              sugerido={`${sugerido.inventario.diasCoberturaAlerta} días`}
              ajustado={ajustado('inventario', 'diasCoberturaAlerta')}
            >
              <div className="flex items-center gap-2">
                <Input
                  id={`${id}-cobertura`}
                  type="number"
                  min={1}
                  max={365}
                  step={1}
                  required
                  disabled={!puedeEditar}
                  className="w-28"
                  value={Number.isNaN(form.inventario.diasCoberturaAlerta) ? '' : form.inventario.diasCoberturaAlerta}
                  onChange={(e) => set('inventario', { diasCoberturaAlerta: e.target.valueAsNumber })}
                />
                <span className="text-sm text-navy/60">días</span>
              </div>
            </Campo>
          </div>
        </Card>

        {puedeEditar && (
          <div className="sticky bottom-0 mt-6 flex flex-col gap-2 border-t border-navy/10 bg-slate-50/95 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-end">
            {sinGuardar && <span className="text-sm text-navy/60 sm:mr-auto">Tienes cambios sin guardar.</span>}
            <Button
              type="button"
              variant="ghost"
              disabled={busy || JSON.stringify(form) === JSON.stringify(sugerido)}
              onClick={() => setForm(structuredClone(sugerido))}
            >
              Volver a los valores del perfil
            </Button>
            <Button type="submit" disabled={busy || !sinGuardar}>
              Guardar cambios
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}

function Campo({
  htmlFor,
  label,
  ayuda,
  sugerido,
  ajustado,
  children,
}: {
  htmlFor?: string;
  label: string;
  ayuda?: string;
  sugerido: string;
  ajustado: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="text-sm font-medium text-navy">
            {label}
          </label>
        ) : (
          <span className="text-sm font-medium text-navy">{label}</span>
        )}
        <EtiquetaAjuste sugerido={sugerido} ajustado={ajustado} />
      </div>
      {ayuda && <p className="mb-2 text-xs text-navy/50">{ayuda}</p>}
      {children}
    </div>
  );
}

// Marca los valores que la empresa cambió respecto del perfil.
function EtiquetaAjuste({ sugerido, ajustado }: { sugerido: string; ajustado: boolean }) {
  if (!ajustado) return null;
  return (
    <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[11px] font-medium text-[#8A5A12]">
      Ajustado · sugerido: {sugerido}
    </span>
  );
}
