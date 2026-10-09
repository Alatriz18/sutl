'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Container as ContainerIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useToast } from '@/lib/toast-context';
import { extractApiError } from '@/lib/format';
import { Carrier, Container, EstadoContenedor, Shipment } from '@/types';

const ESTADO_COLOR: Record<EstadoContenedor, string> = {
  abierto: 'bg-sky/10 text-sky',
  cerrado: 'bg-[#fab219]/20 text-[#a86a00]',
  en_transito: 'bg-violet-100 text-violet-700',
  entregado: 'bg-emerald-100 text-emerald-700',
};

export default function ContenedoresPage() {
  const toast = useToast();
  const [containers, setContainers] = useState<Container[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [asignando, setAsignando] = useState<string | null>(null);
  const [form, setForm] = useState({
    numeroContenedor: '',
    tipo: '40HC',
    carrierId: '',
    origen: '',
    destino: '',
    capacidadM3: '',
  });

  async function cargar() {
    setLoading(true);
    const [cRes, carRes, sRes] = await Promise.all([
      api.get<Container[]>('/containers'),
      api.get<Carrier[]>('/carriers'),
      api.get<Shipment[]>('/shipments'),
    ]);
    setContainers(cRes.data);
    setCarriers(carRes.data);
    setShipments(sRes.data);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/containers', {
        ...form,
        carrierId: form.carrierId || undefined,
        capacidadM3: form.capacidadM3 ? Number(form.capacidadM3) : undefined,
      });
      setForm((f) => ({ ...f, numeroContenedor: '', origen: '', destino: '', capacidadM3: '' }));
      toast.success('Contenedor creado correctamente.');
      await cargar();
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo crear el contenedor.'));
    } finally {
      setSaving(false);
    }
  }

  async function asignarEnvio(containerId: string, shipmentId: string) {
    if (!shipmentId) return;
    setAsignando(containerId);
    try {
      await api.post(`/containers/${containerId}/envios/${shipmentId}`);
      toast.success('Envío asignado al contenedor.');
      await cargar();
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo asignar el envío.'));
    } finally {
      setAsignando(null);
    }
  }

  const shipmentsSinContenedor = shipments.filter((s) => !s.containerId);

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Contenedores y consolidación</h1>
      <p className="mt-1 text-navy/60">Agrupa varios envíos pequeños en un contenedor compartido.</p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {containers.length === 0 && (
                <p className="text-sm text-navy/50">Aún no hay contenedores registrados.</p>
              )}
              {containers.map((c) => (
                <Card key={c.id}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-navy">{c.numeroContenedor}</p>
                      <p className="text-xs uppercase tracking-wide text-navy/40">
                        {c.tipo ?? '—'} · {c.carrier?.nombre ?? 'Sin naviera'}
                      </p>
                    </div>
                    <span className="rounded-md bg-navy/10 p-2 text-navy">
                      <ContainerIcon size={18} />
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-navy/60">
                    {c.origen} → {c.destino}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-navy/60">
                      {c.envios?.length ?? 0} envíos consolidados
                      {c.capacidadM3 ? ` · ${c.capacidadM3} m³` : ''}
                    </span>
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
                        ESTADO_COLOR[c.estado],
                      )}
                    >
                      {c.estado.replace('_', ' ')}
                    </span>
                  </div>
                  {c.envios && c.envios.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-xs text-navy/50">
                      {c.envios.map((s) => (
                        <li key={s.id}>· {s.codigoGuia}</li>
                      ))}
                    </ul>
                  )}
                  <select
                    className="mt-3 w-full rounded-md border border-navy/20 px-2 py-1.5 text-xs"
                    disabled={asignando === c.id}
                    value=""
                    onChange={(e) => asignarEnvio(c.id, e.target.value)}
                  >
                    <option value="">+ Asignar envío...</option>
                    {shipmentsSinContenedor.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.codigoGuia}
                      </option>
                    ))}
                  </select>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Card>
          <CardTitle>Nuevo contenedor</CardTitle>
          <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-3">
            <Input
              placeholder="Número de contenedor"
              required
              value={form.numeroContenedor}
              onChange={(e) => setForm((f) => ({ ...f, numeroContenedor: e.target.value }))}
            />
            <Input
              placeholder="Tipo (ej. 40HC, 20GP)"
              value={form.tipo}
              onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
            />
            <select
              className="w-full rounded-md border border-navy/20 px-3 py-2 text-sm"
              value={form.carrierId}
              onChange={(e) => setForm((f) => ({ ...f, carrierId: e.target.value }))}
            >
              <option value="">Naviera (opcional)</option>
              {carriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Origen"
                required
                value={form.origen}
                onChange={(e) => setForm((f) => ({ ...f, origen: e.target.value }))}
              />
              <Input
                placeholder="Destino"
                required
                value={form.destino}
                onChange={(e) => setForm((f) => ({ ...f, destino: e.target.value }))}
              />
            </div>
            <Input
              type="number"
              placeholder="Capacidad (m³, opcional)"
              value={form.capacidadM3}
              onChange={(e) => setForm((f) => ({ ...f, capacidadM3: e.target.value }))}
            />
            <Button type="submit" disabled={saving}>
              {saving ? 'Creando...' : 'Crear contenedor'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
