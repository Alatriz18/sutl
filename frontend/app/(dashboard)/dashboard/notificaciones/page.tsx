'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Mail, Smartphone, MessageSquare, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DemoBanner } from '@/components/ui/demo-banner';
import { TableSkeleton } from '@/components/ui/skeleton';
import { useToast } from '@/lib/toast-context';
import { extractApiError, formatDateTime } from '@/lib/format';
import { AppNotification, CanalNotificacion } from '@/types';

const CANAL_ICON = { email: Mail, push: Smartphone, sms: MessageSquare } as const;
const CANAL_LABEL = { email: 'Email', push: 'Push', sms: 'SMS' } as const;

const ESTADO_ICON = { enviado: CheckCircle2, pendiente: Clock, fallido: XCircle } as const;
const ESTADO_COLOR = {
  enviado: 'text-[#0ca30c]',
  pendiente: 'text-[#a86a00]',
  fallido: 'text-[#d03b3b]',
} as const;

export default function NotificacionesPage() {
  const toast = useToast();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [form, setForm] = useState({
    canal: 'email' as CanalNotificacion,
    tipo: 'personalizada',
    asunto: '',
    mensaje: '',
  });

  async function cargar() {
    setLoading(true);
    const res = await api.get<AppNotification[]>('/notifications');
    setNotifications(res.data);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/notifications', form);
      setForm((f) => ({ ...f, asunto: '', mensaje: '' }));
      toast.success('Notificación registrada como pendiente.');
      await cargar();
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo crear la notificación.'));
    } finally {
      setSaving(false);
    }
  }

  async function marcarEnviada(id: string) {
    setEnviando(id);
    try {
      await api.patch(`/notifications/${id}/marcar-enviada`);
      toast.success('Notificación marcada como enviada.');
      await cargar();
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo actualizar la notificación.'));
    } finally {
      setEnviando(null);
    }
  }

  const stats = useMemo(() => {
    const total = notifications.length;
    const enviadas = notifications.filter((n) => n.estado === 'enviado').length;
    const fallidas = notifications.filter((n) => n.estado === 'fallido').length;
    const tasa = total > 0 ? ((enviadas / total) * 100).toFixed(1) : '—';
    return { enviadas, fallidas, tasa };
  }, [notifications]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Notificaciones</h1>
      <p className="mt-1 text-navy/60">Email, push y SMS asociados a eventos de tus envíos.</p>

      <DemoBanner>
        El registro de notificaciones ya es real (se guarda en la base de datos). Lo que falta es
        conectar un proveedor real (Amazon SES, Firebase Cloud Messaging, Twilio) — por ahora
        &quot;marcar enviada&quot; simula ese resultado para poder probar el flujo completo.
      </DemoBanner>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <p className="text-sm text-navy/60">Enviadas</p>
              <p className="mt-1 text-2xl font-bold text-navy">{stats.enviadas}</p>
            </Card>
            <Card>
              <p className="text-sm text-navy/60">Tasa de entrega</p>
              <p className="mt-1 text-2xl font-bold text-[#0ca30c]">
                {stats.tasa}
                {stats.tasa !== '—' ? '%' : ''}
              </p>
            </Card>
            <Card>
              <p className="text-sm text-navy/60">Fallidas</p>
              <p className="mt-1 text-2xl font-bold text-[#d03b3b]">{stats.fallidas}</p>
            </Card>
          </div>

          <div className="overflow-x-auto rounded-lg border border-navy/10 bg-white">
            {loading ? (
              <TableSkeleton rows={4} cols={6} />
            ) : (
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="bg-navy/5 text-navy/70">
                  <tr>
                    <th className="px-4 py-3 font-medium">Canal</th>
                    <th className="px-4 py-3 font-medium">Asunto</th>
                    <th className="px-4 py-3 font-medium">Destinatario</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium">Fecha</th>
                    <th className="px-4 py-3 font-medium"></th>
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
                      <tr key={n.id} className="border-t border-navy/5">
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 text-navy/70">
                            <CanalIcon size={15} />
                            {CANAL_LABEL[n.canal]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-navy">{n.asunto}</td>
                        <td className="px-4 py-3 text-navy/60">{n.user?.email ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 text-xs font-medium capitalize ${ESTADO_COLOR[n.estado]}`}
                          >
                            <EstadoIcon size={14} />
                            {n.estado}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-navy/50">
                          {n.enviadoAt ? formatDateTime(n.enviadoAt) : formatDateTime(n.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {n.estado === 'pendiente' && (
                            <button
                              disabled={enviando === n.id}
                              onClick={() => marcarEnviada(n.id)}
                              className="text-xs font-medium text-sky hover:underline disabled:opacity-40"
                            >
                              {enviando === n.id ? 'Enviando...' : 'Marcar enviada'}
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
              className="w-full rounded-md border border-navy/20 px-3 py-2 text-sm"
              value={form.canal}
              onChange={(e) => setForm((f) => ({ ...f, canal: e.target.value as CanalNotificacion }))}
            >
              <option value="email">Email</option>
              <option value="push">Push</option>
              <option value="sms">SMS</option>
            </select>
            <Input
              placeholder="Tipo (ej. cambio_estado)"
              required
              value={form.tipo}
              onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
            />
            <Input
              placeholder="Asunto"
              required
              value={form.asunto}
              onChange={(e) => setForm((f) => ({ ...f, asunto: e.target.value }))}
            />
            <textarea
              className="w-full rounded-md border border-navy/20 px-3 py-2 text-sm"
              rows={3}
              placeholder="Mensaje"
              required
              value={form.mensaje}
              onChange={(e) => setForm((f) => ({ ...f, mensaje: e.target.value }))}
            />
            <Button type="submit" disabled={saving}>
              {saving ? 'Creando...' : 'Registrar notificación'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
