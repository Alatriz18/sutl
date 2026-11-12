'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Trash2, Webhook as WebhookIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/lib/toast-context';
import { cn } from '@/lib/utils';
import { extractApiError, formatDateTime } from '@/lib/format';
import { EntregaWebhook, EventoWebhook, Webhook } from '@/types';
import { SecretoUnaVez } from './secreto-una-vez';

const EVENTOS: { id: EventoWebhook; label: string }[] = [
  { id: 'envio.creado', label: 'Envío creado' },
  { id: 'envio.estado_cambiado', label: 'Envío cambió de estado' },
  { id: 'orden_compra.estado_cambiado', label: 'OC cambió de estado' },
  { id: 'riesgo.semaforo_cambiado', label: 'Riesgo de un SKU cambió' },
];
const EVENTO_LABEL = Object.fromEntries(EVENTOS.map((e) => [e.id, e.label]));

const ESTADO_ENTREGA = {
  entregado: { texto: 'Entregada', clase: 'text-[#1A7A4C]' },
  pendiente: { texto: 'Pendiente', clase: 'text-[#8A5A12]' },
  fallido: { texto: 'Fallida', clase: 'text-[#B3362B]' },
} as const;

// Webhooks salientes firmados. Contrato real: backend/src/modules/webhooks.
export function WebhooksCard() {
  const toast = useToast();
  const [hooks, setHooks] = useState<Webhook[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ url: string; eventos: EventoWebhook[] }>({ url: '', eventos: ['envio.estado_cambiado'] });
  const [guardando, setGuardando] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [secreto, setSecreto] = useState<string | null>(null);
  const [verEntregas, setVerEntregas] = useState<string | null>(null);
  const [entregas, setEntregas] = useState<EntregaWebhook[]>([]);
  const [confirmando, setConfirmando] = useState<string | null>(null);

  const cargar = useCallback(() => {
    api
      .get<Webhook[]>('/webhooks')
      .then((r) => setHooks(r.data))
      .catch((e) => setError(extractApiError(e, 'No se pudieron cargar los webhooks.')));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function cargarEntregas(id: string) {
    const r = await api.get<EntregaWebhook[]>(`/webhooks/${id}/entregas`);
    setEntregas(r.data);
  }

  async function alternarEntregas(id: string) {
    if (verEntregas === id) return setVerEntregas(null);
    setVerEntregas(id);
    await cargarEntregas(id).catch(() => setEntregas([]));
  }

  async function crear(e: FormEvent) {
    e.preventDefault();
    setGuardando(true);
    try {
      const r = await api.post<Webhook>('/webhooks', form);
      setSecreto(r.data.secreto ?? null);
      setForm({ url: '', eventos: ['envio.estado_cambiado'] });
      cargar();
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo crear el webhook.'));
    } finally {
      setGuardando(false);
    }
  }

  async function ejecutar(id: string, accion: () => Promise<unknown>, ok: string, fallo: string) {
    setOcupado(id);
    try {
      await accion();
      toast.success(ok);
      cargar();
      if (verEntregas === id) await cargarEntregas(id).catch(() => undefined);
    } catch (err) {
      toast.error(extractApiError(err, fallo));
    } finally {
      setOcupado(null);
    }
  }

  const alternarEvento = (ev: EventoWebhook) =>
    setForm((f) => ({ ...f, eventos: f.eventos.includes(ev) ? f.eventos.filter((x) => x !== ev) : [...f.eventos, ev] }));

  return (
    <Card>
      <div className="flex items-center gap-2">
        <WebhookIcon size={16} className="text-navy/50" aria-hidden />
        <CardTitle className="!mb-0">Webhooks salientes</CardTitle>
      </div>
      <p className="mt-1 text-sm text-navy/60">
        SUTL avisa a tu sistema cuando pasa algo, sin que tengas que consultar la API. Cada aviso va firmado (<code className="text-xs">X-SUTL-Signature</code>, HMAC-SHA256) con el secreto del webhook y se reintenta si tu servidor falla.
      </p>

      {secreto && <SecretoUnaVez titulo="Secreto del webhook (para verificar la firma)" valor={secreto} onCerrar={() => setSecreto(null)} />}

      <div className="mt-4 flex flex-col gap-2">
        {error && <p className="text-sm text-[#B3362B]">{error}</p>}
        {hooks && hooks.length === 0 && <p className="text-sm text-navy/40">Aún no hay webhooks.</p>}
        {hooks?.map((w) => (
          <div key={w.id} className={cn('rounded-md border border-navy/10 px-3 py-2.5', !w.activo && 'opacity-60')}>
            <div className="flex items-center justify-between gap-3">
              <code className="min-w-0 truncate text-xs text-navy">{w.url}</code>
              <div className="flex shrink-0 items-center gap-3 text-xs">
                <button
                  disabled={ocupado === w.id}
                  onClick={() => ejecutar(w.id, () => api.post(`/webhooks/${w.id}/probar`), 'Entrega de prueba en cola.', 'No se pudo enviar la prueba.')}
                  className="font-medium text-sky hover:underline disabled:opacity-40"
                >
                  Probar
                </button>
                <button
                  disabled={ocupado === w.id}
                  onClick={() =>
                    ejecutar(w.id, () => api.patch(`/webhooks/${w.id}`, { activo: !w.activo }), w.activo ? 'Webhook desactivado.' : 'Webhook activado.', 'No se pudo cambiar el estado.')
                  }
                  className="font-medium text-navy/60 hover:underline disabled:opacity-40"
                >
                  {w.activo ? 'Desactivar' : 'Activar'}
                </button>
                {confirmando === w.id ? (
                  <>
                    <button
                      onClick={() => {
                        setConfirmando(null);
                        void ejecutar(w.id, () => api.delete(`/webhooks/${w.id}`), 'Webhook eliminado.', 'No se pudo eliminar el webhook.');
                      }}
                      className="font-medium text-[#B3362B] hover:underline"
                    >
                      Sí, eliminar
                    </button>
                    <button onClick={() => setConfirmando(null)} className="text-navy/50 hover:underline">
                      Cancelar
                    </button>
                  </>
                ) : (
                  <button onClick={() => setConfirmando(w.id)} className="text-navy/40 hover:text-[#B3362B]" aria-label={`Eliminar el webhook ${w.url}`}>
                    <Trash2 size={14} aria-hidden />
                  </button>
                )}
              </div>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {w.eventos.map((ev) => (
                <span key={ev} className="rounded-full bg-navy/5 px-1.5 py-0.5 text-[10px] text-navy/60">
                  {EVENTO_LABEL[ev] ?? ev}
                </span>
              ))}
            </div>
            <div className="mt-1.5 flex items-center gap-3 text-[11px] text-navy/50">
              {w.ultimaEntrega ? (
                <span>
                  Última entrega {formatDateTime(w.ultimaEntrega.createdAt)} —{' '}
                  <span className={ESTADO_ENTREGA[w.ultimaEntrega.estado].clase}>{ESTADO_ENTREGA[w.ultimaEntrega.estado].texto}</span>
                </span>
              ) : (
                <span>Sin entregas todavía</span>
              )}
              <button onClick={() => alternarEntregas(w.id)} className="font-medium text-sky hover:underline" aria-expanded={verEntregas === w.id}>
                {verEntregas === w.id ? 'Ocultar historial' : 'Ver historial'}
              </button>
            </div>
            {verEntregas === w.id && (
              <ul className="mt-2 space-y-1 border-t border-navy/5 pt-2">
                {entregas.length === 0 && <li className="text-xs text-navy/40">Sin entregas.</li>}
                {entregas.map((e) => (
                  <li key={e.id} className="text-xs text-navy/70">
                    <span className={cn('font-medium', ESTADO_ENTREGA[e.estado].clase)}>{ESTADO_ENTREGA[e.estado].texto}</span>
                    {' · '}
                    {EVENTO_LABEL[e.evento] ?? e.evento}
                    {' · '}
                    {formatDateTime(e.createdAt)}
                    {e.intentos > 1 && ` · ${e.intentos} intentos`}
                    {e.error && <span className="block text-[#B3362B]">{e.error}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={crear} className="mt-4 flex flex-col gap-2">
        <Input
          aria-label="URL del webhook"
          placeholder="https://tu-erp.com/webhooks/sutl"
          required
          type="url"
          maxLength={500}
          value={form.url}
          onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
        />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Eventos a los que suscribirse">
          {EVENTOS.map((ev) => (
            <button
              type="button"
              key={ev.id}
              aria-pressed={form.eventos.includes(ev.id)}
              onClick={() => alternarEvento(ev.id)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                form.eventos.includes(ev.id) ? 'border-sky bg-sky/10 text-sky' : 'border-navy/15 text-navy/50 hover:border-navy/30',
              )}
            >
              {ev.label}
            </button>
          ))}
        </div>
        <Button type="submit" disabled={guardando || form.eventos.length === 0}>
          {guardando ? 'Creando...' : 'Agregar webhook'}
        </Button>
      </form>
    </Card>
  );
}
