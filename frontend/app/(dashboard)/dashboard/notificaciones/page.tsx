'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Mail, MessageCircle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TableSkeleton } from '@/components/ui/skeleton';
import { useToast } from '@/lib/toast-context';
import { extractApiError, formatDateTime } from '@/lib/format';
import { AppNotification, CanalNotificacion, CanalesDisponibles } from '@/types';

// Push y SMS siguen sin proveedor: el backend los rechaza, así que no se ofrecen.
const CANAL_ICON = { email: Mail, whatsapp: MessageCircle, push: Mail, sms: Mail } as const;
const CANAL_LABEL = { email: 'Email', whatsapp: 'WhatsApp', push: 'Push', sms: 'SMS' } as const;

const ESTADO_ICON = { enviado: CheckCircle2, pendiente: Clock, fallido: XCircle } as const;
const ESTADO_COLOR = {
  enviado: 'text-[#1A7A4C]',
  pendiente: 'text-[#8A5A12]',
  fallido: 'text-[#B3362B]',
} as const;
const ESTADO_LABEL = { enviado: 'Enviada', pendiente: 'Pendiente', fallido: 'Fallida' } as const;

const FORM_VACIO = { canal: 'email' as CanalNotificacion, tipo: 'personalizada', destino: '', asunto: '', mensaje: '' };

export default function NotificacionesPage() {
  const toast = useToast();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [canales, setCanales] = useState<CanalesDisponibles | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reenviando, setReenviando] = useState<string | null>(null);
  const [form, setForm] = useState(FORM_VACIO);

  async function cargar() {
    const [lista, disp] = await Promise.all([
      api.get<AppNotification[]>('/notifications'),
      api.get<CanalesDisponibles>('/notifications/canales'),
    ]);
    setNotifications(lista.data);
    setCanales(disp.data);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  // Un envío por la cola puede tardar unos segundos: mientras haya pendientes se vuelve a consultar.
  const hayPendientes = notifications.some((n) => n.estado === 'pendiente');
  useEffect(() => {
    if (!hayPendientes) return;
    const t = setInterval(() => {
      api.get<AppNotification[]>('/notifications').then((r) => setNotifications(r.data));
    }, 2000);
    return () => clearInterval(t);
  }, [hayPendientes]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/notifications', { ...form, destino: form.destino.trim() || undefined });
      setForm((f) => ({ ...f, asunto: '', mensaje: '', destino: '' }));
      toast.success('Notificación en cola de envío.');
      await cargar();
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo crear la notificación.'));
    } finally {
      setSaving(false);
    }
  }

  async function reenviar(id: string) {
    setReenviando(id);
    try {
      await api.post(`/notifications/${id}/reenviar`);
      toast.success('Reenvío en cola.');
      await cargar();
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo reenviar la notificación.'));
    } finally {
      setReenviando(null);
    }
  }

  const stats = useMemo(() => {
    const total = notifications.length;
    const enviadas = notifications.filter((n) => n.estado === 'enviado').length;
    const fallidas = notifications.filter((n) => n.estado === 'fallido').length;
    const tasa = total > 0 ? ((enviadas / total) * 100).toFixed(1) : '—';
    return { enviadas, fallidas, tasa };
  }, [notifications]);

  const esWhatsapp = form.canal === 'whatsapp';

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Notificaciones</h1>
      <p className="mt-1 text-navy/60">
        Correo y WhatsApp para avisar a tus clientes y proveedores. El envío es real: sale por la cola, se reintenta si el proveedor falla y puedes reenviar lo que no llegó.
      </p>
      {canales && !canales.whatsapp && (
        <p className="mt-4 rounded-lg border border-sky/20 bg-sky/5 px-4 py-3 text-sm text-navy/70">
          WhatsApp todavía no está conectado en este servidor (falta la cuenta de WhatsApp Cloud API). El correo sí está disponible.
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <p className="text-sm text-navy/60">Enviadas</p>
              <p className="mt-1 text-2xl font-bold text-navy">{stats.enviadas}</p>
            </Card>
            <Card>
              <p className="text-sm text-navy/60">Tasa de entrega</p>
              <p className="mt-1 text-2xl font-bold text-[#1A7A4C]">
                {stats.tasa}
                {stats.tasa !== '—' ? '%' : ''}
              </p>
            </Card>
            <Card>
              <p className="text-sm text-navy/60">Fallidas</p>
              <p className="mt-1 text-2xl font-bold text-[#B3362B]">{stats.fallidas}</p>
            </Card>
          </div>

          <div
            tabIndex={0}
            role="region"
            aria-label="Historial de notificaciones"
            className="overflow-x-auto rounded-lg border border-navy/10 bg-white"
          >
            {loading ? (
              <TableSkeleton rows={4} cols={6} />
            ) : (
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="bg-navy/5 text-navy/70">
                  <tr>
                    <th className="px-4 py-3 font-medium">Canal</th>
                    <th className="px-4 py-3 font-medium">Asunto</th>
                    <th className="px-4 py-3 font-medium">Destino</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium">Fecha</th>
                    <th className="px-4 py-3 font-medium">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {notifications.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-navy/50">
                        Aún no hay notificaciones.
                      </td>
                    </tr>
                  )}
                  {notifications.map((n) => {
                    const CanalIcon = CANAL_ICON[n.canal];
                    const EstadoIcon = ESTADO_ICON[n.estado];
                    return (
                      <tr key={n.id} className="border-t border-navy/5 align-top">
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 text-navy/70">
                            <CanalIcon size={15} aria-hidden />
                            {CANAL_LABEL[n.canal]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-navy">{n.asunto}</td>
                        <td className="px-4 py-3 text-navy/60">{n.destino ?? n.user?.email ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${ESTADO_COLOR[n.estado]}`}>
                            <EstadoIcon size={14} aria-hidden />
                            {ESTADO_LABEL[n.estado]}
                          </span>
                          {n.estado !== 'enviado' && n.error && <p className="mt-1 max-w-[220px] text-xs text-navy/60">{n.error}</p>}
                          {(n.intentos ?? 0) > 1 && <p className="mt-0.5 text-xs text-navy/40">{n.intentos} intentos</p>}
                        </td>
                        <td className="px-4 py-3 text-navy/50">{n.enviadoAt ? formatDateTime(n.enviadoAt) : formatDateTime(n.createdAt)}</td>
                        <td className="px-4 py-3 text-right">
                          {n.estado === 'fallido' && (
                            <button
                              disabled={reenviando === n.id}
                              onClick={() => reenviar(n.id)}
                              className="text-xs font-medium text-sky hover:underline disabled:opacity-40"
                              aria-label={`Reenviar la notificación «${n.asunto}»`}
                            >
                              {reenviando === n.id ? 'Reenviando...' : 'Reenviar'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <Card>
          <CardTitle>Nueva notificación</CardTitle>
          <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-3">
            <select
              aria-label="Canal de notificación"
              className="w-full rounded-md border border-navy/20 px-3 py-2 text-sm"
              value={form.canal}
              onChange={(e) => setForm((f) => ({ ...f, canal: e.target.value as CanalNotificacion, destino: '' }))}
            >
              <option value="email" disabled={canales ? !canales.email : false}>
                Email
              </option>
              <option value="whatsapp" disabled={canales ? !canales.whatsapp : false}>
                WhatsApp{canales && !canales.whatsapp ? ' (no conectado)' : ''}
              </option>
            </select>
            <Input
              aria-label={esWhatsapp ? 'Teléfono de destino' : 'Correo de destino'}
              type={esWhatsapp ? 'tel' : 'email'}
              placeholder={esWhatsapp ? 'Teléfono: +593991234567' : 'Correo del destinatario'}
              required
              value={form.destino}
              onChange={(e) => setForm((f) => ({ ...f, destino: e.target.value }))}
            />
            <Input
              aria-label="Tipo de notificación"
              placeholder="Tipo (ej. cambio_estado)"
              required
              value={form.tipo}
              onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
            />
            <Input
              aria-label="Asunto"
              placeholder="Asunto"
              required
              maxLength={200}
              value={form.asunto}
              onChange={(e) => setForm((f) => ({ ...f, asunto: e.target.value }))}
            />
            <textarea
              aria-label="Mensaje"
              className="w-full rounded-md border border-navy/20 px-3 py-2 text-sm"
              rows={3}
              placeholder="Mensaje"
              required
              maxLength={4000}
              value={form.mensaje}
              onChange={(e) => setForm((f) => ({ ...f, mensaje: e.target.value }))}
            />
            {esWhatsapp && (
              <p className="text-xs text-navy/50">
                WhatsApp solo entrega texto libre si la persona escribió a tu número en las últimas 24 horas; fuera de esa ventana hacen falta plantillas aprobadas por Meta.
              </p>
            )}
            <Button type="submit" disabled={saving}>
              {saving ? 'Enviando...' : 'Enviar notificación'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
