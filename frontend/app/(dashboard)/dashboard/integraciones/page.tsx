'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Globe2,
  Key,
  Link2,
  Package2,
  Plug,
  RefreshCw,
  ShoppingBag,
  Ship,
  Trash2,
  Webhook as WebhookIcon,
  XCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DemoBanner } from '@/components/ui/demo-banner';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useToast } from '@/lib/toast-context';
import { extractApiError, formatDateTime } from '@/lib/format';
import {
  ApiKey,
  CategoriaIntegracion,
  EventoWebhook,
  Integration,
  IntegrationProvider,
  Webhook,
} from '@/types';

const CATEGORIA_LABEL: Record<CategoriaIntegracion, string> = {
  courier: 'Couriers',
  ecommerce: 'E-commerce',
  naviera_aerolinea: 'Navieras y aerolíneas (API)',
  erp_externo: 'ERP / sistemas externos',
};

const CATEGORIA_ICON: Record<CategoriaIntegracion, typeof Package2> = {
  courier: Package2,
  ecommerce: ShoppingBag,
  naviera_aerolinea: Ship,
  erp_externo: Globe2,
};

const CATEGORIA_ORDEN: CategoriaIntegracion[] = ['courier', 'ecommerce', 'naviera_aerolinea', 'erp_externo'];

const EVENTOS: EventoWebhook[] = ['envio.creado', 'envio.actualizado', 'envio.entregado', 'factura.pagada'];

export default function IntegracionesPage() {
  const toast = useToast();
  const [providers, setProviders] = useState<IntegrationProvider[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyProviderId, setBusyProviderId] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [savingHook, setSavingHook] = useState(false);
  const [busyHookId, setBusyHookId] = useState<string | null>(null);
  const [hookForm, setHookForm] = useState<{ url: string; eventos: EventoWebhook[] }>({
    url: '',
    eventos: ['envio.actualizado'],
  });

  async function cargar() {
    setLoading(true);
    const [provRes, intRes, keyRes, hookRes] = await Promise.all([
      api.get<IntegrationProvider[]>('/integrations/providers'),
      api.get<Integration[]>('/integrations'),
      api.get<ApiKey[]>('/api-keys'),
      api.get<Webhook[]>('/webhooks'),
    ]);
    setProviders(provRes.data);
    setIntegrations(intRes.data);
    setApiKeys(keyRes.data);
    setWebhooks(hookRes.data);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  const integrationByProvider = useMemo(() => {
    const map: Record<string, Integration> = {};
    for (const i of integrations) map[i.providerId] = i;
    return map;
  }, [integrations]);

  const porCategoria = useMemo(() => {
    const map = new Map<CategoriaIntegracion, IntegrationProvider[]>();
    for (const p of providers) {
      const lista = map.get(p.categoria) ?? [];
      lista.push(p);
      map.set(p.categoria, lista);
    }
    return map;
  }, [providers]);

  async function conectar(providerId: string) {
    setBusyProviderId(providerId);
    try {
      await api.post('/integrations', { providerId });
      toast.success('Integración conectada.');
      await cargar();
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo conectar la integración.'));
    } finally {
      setBusyProviderId(null);
    }
  }

  async function sincronizar(integration: Integration) {
    setBusyProviderId(integration.providerId);
    try {
      await api.post(`/integrations/${integration.id}/sincronizar`);
      toast.success('Sincronización completada.');
      await cargar();
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo sincronizar.'));
    } finally {
      setBusyProviderId(null);
    }
  }

  async function desconectar(integration: Integration) {
    setBusyProviderId(integration.providerId);
    try {
      await api.post(`/integrations/${integration.id}/desconectar`);
      toast.success('Integración desconectada.');
      await cargar();
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo desconectar.'));
    } finally {
      setBusyProviderId(null);
    }
  }

  async function crearApiKey(e: FormEvent) {
    e.preventDefault();
    setSavingKey(true);
    try {
      await api.post('/api-keys', { nombre: keyName });
      setKeyName('');
      toast.success('API key creada.');
      await cargar();
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo crear la API key.'));
    } finally {
      setSavingKey(false);
    }
  }

  async function revocarApiKey(id: string) {
    try {
      await api.delete(`/api-keys/${id}`);
      toast.success('API key revocada.');
      await cargar();
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo revocar la API key.'));
    }
  }

  function toggleEvento(ev: EventoWebhook) {
    setHookForm((f) => ({
      ...f,
      eventos: f.eventos.includes(ev) ? f.eventos.filter((e) => e !== ev) : [...f.eventos, ev],
    }));
  }

  async function crearWebhook(e: FormEvent) {
    e.preventDefault();
    setSavingHook(true);
    try {
      await api.post('/webhooks', hookForm);
      setHookForm({ url: '', eventos: ['envio.actualizado'] });
      toast.success('Webhook registrado.');
      await cargar();
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo crear el webhook.'));
    } finally {
      setSavingHook(false);
    }
  }

  async function probarWebhook(id: string) {
    setBusyHookId(id);
    try {
      await api.post(`/webhooks/${id}/probar`);
      toast.success('Entrega de prueba enviada.');
      await cargar();
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo enviar la prueba.'));
    } finally {
      setBusyHookId(null);
    }
  }

  async function eliminarWebhook(id: string) {
    setBusyHookId(id);
    try {
      await api.delete(`/webhooks/${id}`);
      toast.success('Webhook eliminado.');
      await cargar();
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo eliminar el webhook.'));
    } finally {
      setBusyHookId(null);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Integraciones</h1>
      <p className="mt-1 text-navy/60">
        Conecta couriers, tiendas online, navieras/aerolíneas y tus propios sistemas — la base del
        tracking universal de SUTL.
      </p>

      <DemoBanner>
        Las conexiones aquí son simuladas (modo demo): &quot;Conectar&quot; y &quot;Sincronizar&quot;
        no llaman a un proveedor real todavía, pero el flujo — catálogo de proveedores, estado de
        conexión, API keys y webhooks salientes — es el mismo que tendrá la integración real.
      </DemoBanner>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {CATEGORIA_ORDEN.map((categoria) => {
            const lista = porCategoria.get(categoria);
            if (!lista || lista.length === 0) return null;
            const CategoriaIcon = CATEGORIA_ICON[categoria];
            return (
              <div key={categoria}>
                <div className="mb-3 flex items-center gap-2">
                  <CategoriaIcon size={16} className="text-navy/50" />
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-navy/60">
                    {CATEGORIA_LABEL[categoria]}
                  </h2>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {lista.map((provider) => {
                    const integration = integrationByProvider[provider.id];
                    const estado = integration?.estado;
                    const busy = busyProviderId === provider.id;
                    return (
                      <Card key={provider.id} className="flex flex-col">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <span className="mt-0.5 rounded-md bg-navy/5 p-2 text-navy">
                              <Plug size={16} />
                            </span>
                            <div>
                              <p className="font-medium text-navy">{provider.nombre}</p>
                              <p className="mt-0.5 text-xs text-navy/50">{provider.descripcion}</p>
                            </div>
                          </div>
                          {estado && (
                            <span
                              className={cn(
                                'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                                estado === 'conectado' && 'bg-[#1A7A4C]/10 text-[#1A7A4C]',
                                estado === 'error' && 'bg-[#B3362B]/10 text-[#B3362B]',
                                estado === 'desconectado' && 'bg-slate-100 text-slate-600',
                              )}
                            >
                              {estado === 'conectado' && <CheckCircle2 size={12} />}
                              {estado === 'error' && <XCircle size={12} />}
                              {estado}
                            </span>
                          )}
                        </div>

                        {integration && estado !== 'desconectado' && (
                          <p className="mt-3 text-xs text-navy/50">
                            {integration.enviosImportados} envío(s) importado(s)
                            {integration.ultimaSincronizacion && (
                              <> · última sync {formatDateTime(integration.ultimaSincronizacion)}</>
                            )}
                          </p>
                        )}

                        <div className="mt-4 flex gap-2">
                          {!integration || estado === 'desconectado' ? (
                            <Button
                              variant="secondary"
                              className="w-full px-3 py-1.5 text-xs"
                              disabled={busy}
                              onClick={() => conectar(provider.id)}
                            >
                              <Link2 size={13} />
                              {busy ? 'Conectando...' : 'Conectar'}
                            </Button>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                className="flex-1 border border-navy/15 px-3 py-1.5 text-xs"
                                disabled={busy}
                                onClick={() => sincronizar(integration)}
                              >
                                <RefreshCw size={13} />
                                {busy ? 'Sincronizando...' : 'Sincronizar'}
                              </Button>
                              <Button
                                variant="ghost"
                                className="px-3 py-1.5 text-xs text-[#B3362B] hover:bg-[#B3362B]/5"
                                disabled={busy}
                                onClick={() => desconectar(integration)}
                              >
                                Desconectar
                              </Button>
                            </>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex items-center gap-2">
            <Key size={16} className="text-navy/50" />
            <CardTitle className="!mb-0">API keys</CardTitle>
          </div>
          <p className="mt-1 text-sm text-navy/60">
            Para que un sistema externo (tu ERP, un marketplace propio) consulte o cree envíos en SUTL.
          </p>

          <div className="mt-4 flex flex-col gap-2">
            {apiKeys.length === 0 && <p className="text-sm text-navy/40">Aún no hay API keys.</p>}
            {apiKeys.map((k) => (
              <div
                key={k.id}
                className="flex items-center justify-between gap-3 rounded-md border border-navy/10 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-navy">{k.nombre}</p>
                  <code className="text-xs text-navy/50">{k.llavePublica}</code>
                </div>
                <button
                  onClick={() => revocarApiKey(k.id)}
                  className="shrink-0 text-navy/40 hover:text-[#B3362B]"
                  title="Revocar"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>

          <form onSubmit={crearApiKey} className="mt-4 flex gap-2">
            <Input
              placeholder="Nombre de la integración (ej. ERP interno)"
              required
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
            />
            <Button type="submit" disabled={savingKey} className="shrink-0">
              {savingKey ? '...' : 'Generar'}
            </Button>
          </form>
        </Card>

        <Card>
          <div className="flex items-center gap-2">
            <WebhookIcon size={16} className="text-navy/50" />
            <CardTitle className="!mb-0">Webhooks salientes</CardTitle>
          </div>
          <p className="mt-1 text-sm text-navy/60">
            SUTL avisa a tu sistema cuando pasa algo — sin que tengas que estar consultando la API.
          </p>

          <div className="mt-4 flex flex-col gap-2">
            {webhooks.length === 0 && <p className="text-sm text-navy/40">Aún no hay webhooks.</p>}
            {webhooks.map((w) => (
              <div key={w.id} className="rounded-md border border-navy/10 px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <code className="min-w-0 truncate text-xs text-navy">{w.url}</code>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      disabled={busyHookId === w.id}
                      onClick={() => probarWebhook(w.id)}
                      className="text-xs font-medium text-sky hover:underline disabled:opacity-40"
                    >
                      Probar
                    </button>
                    <button
                      disabled={busyHookId === w.id}
                      onClick={() => eliminarWebhook(w.id)}
                      className="text-navy/40 hover:text-[#B3362B]"
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {w.eventos.map((ev) => (
                    <span key={ev} className="rounded-full bg-navy/5 px-1.5 py-0.5 text-[10px] text-navy/60">
                      {ev}
                    </span>
                  ))}
                </div>
                {w.ultimoEnvio && (
                  <p className="mt-1.5 text-[11px] text-navy/40">
                    Última entrega {formatDateTime(w.ultimoEnvio)} —{' '}
                    {w.ultimoEnvioOk ? (
                      <span className="text-[#1A7A4C]">OK</span>
                    ) : (
                      <span className="text-[#B3362B]">falló</span>
                    )}
                  </p>
                )}
              </div>
            ))}
          </div>

          <form onSubmit={crearWebhook} className="mt-4 flex flex-col gap-2">
            <Input
              placeholder="https://tu-erp.com/webhooks/sutl"
              required
              type="url"
              value={hookForm.url}
              onChange={(e) => setHookForm((f) => ({ ...f, url: e.target.value }))}
            />
            <div className="flex flex-wrap gap-1.5">
              {EVENTOS.map((ev) => (
                <button
                  type="button"
                  key={ev}
                  onClick={() => toggleEvento(ev)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                    hookForm.eventos.includes(ev)
                      ? 'border-sky bg-sky/10 text-sky'
                      : 'border-navy/15 text-navy/50 hover:border-navy/30',
                  )}
                >
                  {ev}
                </button>
              ))}
            </div>
            <Button type="submit" disabled={savingHook || hookForm.eventos.length === 0}>
              {savingHook ? 'Creando...' : 'Agregar webhook'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
