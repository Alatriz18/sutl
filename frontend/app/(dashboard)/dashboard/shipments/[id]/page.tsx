'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardTitle } from '@/components/ui/card';
import { EstadoBadge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/lib/toast-context';
import { extractApiError, formatDateTime, formatKg } from '@/lib/format';
import { EstadoEnvio, Shipment, TrackingEvent } from '@/types';

const ESTADOS: EstadoEnvio[] = ['creado', 'en_transito', 'en_aduana', 'entregado', 'incidencia'];

const MODO_LABELS: Record<Shipment['modo'], string> = {
  maritimo: 'Marítimo',
  aereo: 'Aéreo',
  terrestre: 'Terrestre',
};

const TIPO_LABELS: Record<Shipment['tipo'], string> = {
  importacion: 'Importación',
  exportacion: 'Exportación',
};

export default function ShipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [eventos, setEventos] = useState<TrackingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [form, setForm] = useState({ estado: 'en_transito' as EstadoEnvio, ubicacion: '', descripcion: '' });
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [shipmentRes, eventosRes] = await Promise.all([
        api.get<Shipment>(`/shipments/${id}`),
        api.get<TrackingEvent[]>(`/tracking-events/shipment/${id}`),
      ]);
      setShipment(shipmentRes.data);
      setEventos(eventosRes.data);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function handleAddEvento(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/tracking-events', { shipmentId: id, ...form });
      setForm({ estado: form.estado, ubicacion: '', descripcion: '' });
      toast.success('Evento de tracking registrado.');
      await cargar();
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo registrar el evento.'));
    } finally {
      setSaving(false);
    }
  }

  if (notFound) {
    return (
      <div className="rounded-lg border border-navy/10 bg-white p-6 text-center">
        <p className="text-navy/70">No se encontró este envío.</p>
        <Link href="/dashboard/shipments" className="mt-2 inline-block text-sm text-sky hover:underline">
          ← Volver a envíos
        </Link>
      </div>
    );
  }

  if (loading || !shipment) {
    return (
      <div>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-2 h-4 w-96" />
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">{shipment.codigoGuia}</h1>
          <p className="text-navy/60">
            {TIPO_LABELS[shipment.tipo]} · {MODO_LABELS[shipment.modo]} · {shipment.origen} →{' '}
            {shipment.destino}
          </p>
          {shipment.bookingId && (
            <Link href="/dashboard/reservas" className="mt-1 inline-block text-xs text-sky hover:underline">
              Originado desde una reserva →
            </Link>
          )}
        </div>
        <EstadoBadge estado={shipment.estado} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Datos del envío</CardTitle>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Naviera / aerolínea" value={shipment.carrier?.nombre ?? 'Sin asignar'} />
            <Row label="Remitente" value={shipment.remitenteNombre} />
            <Row label="Destinatario" value={shipment.destinatarioNombre} />
            <Row label="Email destinatario" value={shipment.destinatarioEmail ?? '—'} />
            <Row label="Referencia (BL/AWB)" value={shipment.referenciaDocumento ?? '—'} />
            <Row label="Puerto origen" value={shipment.puertoOrigen ?? '—'} />
            <Row label="Puerto destino" value={shipment.puertoDestino ?? '—'} />
            <Row label="Peso" value={formatKg(shipment.pesoKg)} />
            <Row
              label="Link público de tracking"
              value={`/tracking/${shipment.codigoGuia}`}
              isLink
            />
          </dl>
        </Card>

        <Card>
          <CardTitle>Registrar evento de tracking</CardTitle>
          <form onSubmit={handleAddEvento} className="mt-3 flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-navy">Nuevo estado</label>
              <select
                className="w-full rounded-md border border-navy/20 px-3 py-2 text-sm"
                value={form.estado}
                onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value as EstadoEnvio }))}
              >
                {ESTADOS.map((estado) => (
                  <option key={estado} value={estado}>
                    {estado}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-navy">Ubicación</label>
              <Input
                value={form.ubicacion}
                onChange={(e) => setForm((f) => ({ ...f, ubicacion: e.target.value }))}
                placeholder="Ej. Bodega Guayaquil"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-navy">Descripción</label>
              <Input
                value={form.descripcion}
                onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                placeholder="Ej. Paquete recibido en bodega"
              />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando...' : 'Agregar evento'}
            </Button>
          </form>
        </Card>
      </div>

      <div className="mt-6">
        <CardTitle className="mb-3">Historial de eventos</CardTitle>
        <ol className="space-y-3">
          {eventos.length === 0 && (
            <p className="text-sm text-navy/50">Todavía no hay eventos registrados.</p>
          )}
          {eventos.map((ev) => (
            <li key={ev._id} className="rounded-lg border border-navy/10 bg-white p-4 text-sm">
              <div className="flex items-center justify-between">
                <EstadoBadge estado={ev.estado} />
                <span className="text-navy/50">{formatDateTime(ev.timestamp)}</span>
              </div>
              {ev.ubicacion && <p className="mt-2 text-navy">📍 {ev.ubicacion}</p>}
              {ev.descripcion && <p className="text-navy/70">{ev.descripcion}</p>}
              <p className="mt-1 text-xs text-navy/40">Registrado por {ev.responsable}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Row({ label, value, isLink }: { label: string; value: string; isLink?: boolean }) {
  return (
    <div className="flex justify-between gap-4 border-b border-navy/5 py-1.5">
      <dt className="text-navy/60">{label}</dt>
      <dd className={isLink ? 'text-sky' : 'font-medium text-navy'}>{value}</dd>
    </div>
  );
}
