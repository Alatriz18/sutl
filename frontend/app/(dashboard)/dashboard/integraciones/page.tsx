'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Globe2, Link2, Package2, Plug, RefreshCw, ShoppingBag, Ship, XCircle } from 'lucide-react';
import { api, DEMO_MODE } from '@/lib/api';
import { ApiKeysCard } from '@/components/integraciones/api-keys-card';
import { WebhooksCard } from '@/components/integraciones/webhooks-card';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DemoBanner } from '@/components/ui/demo-banner';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useToast } from '@/lib/toast-context';
import { extractApiError, formatDateTime } from '@/lib/format';
import { CategoriaIntegracion, Integration, IntegrationProvider } from '@/types';

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

export default function IntegracionesPage() {
  const toast = useToast();
  const [providers, setProviders] = useState<IntegrationProvider[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyProviderId, setBusyProviderId] = useState<string | null>(null);

  async function cargar() {
    // El catálogo de conectores de terceros (couriers, tiendas…) aún no existe en
    // el backend real: solo se muestra en el modo demo.
    if (!DEMO_MODE) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [provRes, intRes] = await Promise.all([api.get<IntegrationProvider[]>('/integrations/providers'), api.get<Integration[]>('/integrations')]);
    setProviders(provRes.data);
    setIntegrations(intRes.data);
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

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Integraciones</h1>
      <p className="mt-1 text-navy/60">
        Conecta tus sistemas con SUTL: consulta tus datos por API y recibe avisos automáticos (webhooks) cuando algo cambia.
      </p>

      {DEMO_MODE ? (
        <DemoBanner>
          El catálogo de conectores (couriers, tiendas online, navieras) es una vista previa simulada: &quot;Conectar&quot; y &quot;Sincronizar&quot; no llaman a un proveedor real todavía. Las API keys y los webhooks de abajo sí usan el contrato real.
        </DemoBanner>
      ) : (
        <p className="mt-4 rounded-lg border border-sky/20 bg-sky/5 px-4 py-3 text-sm text-navy/70">
          Los conectores de couriers, tiendas online y navieras llegan en una próxima fase. Mientras tanto, la API pública y los webhooks ya permiten integrar tu ERP.
        </p>
      )}

      {loading ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        <ApiKeysCard />
        <WebhooksCard />
      </div>
    </div>
  );
}
