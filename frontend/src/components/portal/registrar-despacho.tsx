'use client';

import { FormEvent, useId, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { extractApiError, formatNumber } from '@/lib/format';
import { useToast } from '@/lib/toast-context';
import type { OrdenDeProveedor } from '@/types/proveedor';

const MODOS = [
  { valor: 'maritimo', etiqueta: 'Marítimo' },
  { valor: 'aereo', etiqueta: 'Aéreo' },
  { valor: 'terrestre', etiqueta: 'Terrestre' },
] as const;

const hoy = () => new Date().toISOString().slice(0, 10);
const haceDias = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

// El proveedor avisa que su carga ya salió: indica qué cantidad de cada producto viaja, por dónde y con qué guía.
// El servidor crea el embarque, lo asigna a la orden y revalida todo (cantidades, fechas, que la orden sea suya).
export function RegistrarDespacho({ orden, onRegistrado }: { orden: OrdenDeProveedor; onRegistrado: (o: OrdenDeProveedor) => void }) {
  const uid = useId();
  const toast = useToast();
  const pendiente = (l: OrdenDeProveedor['lineas'][number]) => Math.max(0, l.cantidad - l.embarques.reduce((s, e) => s + e.cantidad, 0));
  const [f, setF] = useState({ modo: 'maritimo', origen: '', destino: '', referenciaDocumento: '', fechaDespacho: hoy(), fechaEstimadaLlegada: '' });
  // Por defecto se propone despachar todo lo que falta; el proveedor ajusta lo que de verdad salió.
  const [cantidades, setCantidades] = useState<Record<string, string>>(() => Object.fromEntries(orden.lineas.map((l) => [l.id, String(pendiente(l))])));
  const [enviando, setEnviando] = useState(false);

  const conPendiente = orden.lineas.filter((l) => pendiente(l) > 0);
  if (conPendiente.length === 0) return null;

  const lineas = conPendiente.map((l) => ({ lineaId: l.id, cantidad: Number(cantidades[l.id]) })).filter((l) => Number.isFinite(l.cantidad) && l.cantidad > 0);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (lineas.length === 0) return;
    setEnviando(true);
    try {
      const r = await api.post<OrdenDeProveedor>(`/portal/ordenes/${orden.id}/despachar`, {
        modo: f.modo,
        origen: f.origen.trim(),
        destino: f.destino.trim(),
        ...(f.referenciaDocumento.trim() ? { referenciaDocumento: f.referenciaDocumento.trim() } : {}),
        fechaDespacho: new Date(`${f.fechaDespacho}T12:00:00`).toISOString(),
        ...(f.fechaEstimadaLlegada ? { fechaEstimadaLlegada: new Date(`${f.fechaEstimadaLlegada}T12:00:00`).toISOString() } : {}),
        lineas,
      });
      onRegistrado(r.data);
      setCantidades(Object.fromEntries(r.data.lineas.map((l) => [l.id, String(pendiente(l))])));
      toast.success('Despacho registrado. La empresa ya puede seguir tu embarque.');
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo registrar el despacho.'));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card className="mt-6">
      <CardTitle>Registrar un despacho</CardTitle>
      <p className="mt-1 text-sm text-navy/60">
        Cuando tu carga salga, indica qué cantidad viaja y por dónde. Se crea el embarque de esta orden y la empresa recibe un aviso. Si despachas por partes, registra cada salida por separado.
      </p>
      <form onSubmit={enviar} className="mt-4 space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor={`${uid}-modo`} className="mb-1 block text-sm font-medium text-navy">Transporte</label>
            <select id={`${uid}-modo`} value={f.modo} onChange={(e) => setF({ ...f, modo: e.target.value })} className="h-10 w-full rounded-md border border-navy/20 bg-white px-2 text-sm text-navy">
              {MODOS.map((m) => <option key={m.valor} value={m.valor}>{m.etiqueta}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={`${uid}-origen`} className="mb-1 block text-sm font-medium text-navy">Origen</label>
            <Input id={`${uid}-origen`} required maxLength={120} value={f.origen} onChange={(e) => setF({ ...f, origen: e.target.value })} placeholder="Ciudad o puerto de salida" />
          </div>
          <div>
            <label htmlFor={`${uid}-destino`} className="mb-1 block text-sm font-medium text-navy">Destino</label>
            <Input id={`${uid}-destino`} required maxLength={120} value={f.destino} onChange={(e) => setF({ ...f, destino: e.target.value })} placeholder="Ciudad o puerto de llegada" />
          </div>
          <div>
            <label htmlFor={`${uid}-fecha`} className="mb-1 block text-sm font-medium text-navy">Fecha en que salió</label>
            <Input id={`${uid}-fecha`} type="date" required min={haceDias(30)} max={hoy()} value={f.fechaDespacho} onChange={(e) => setF({ ...f, fechaDespacho: e.target.value })} />
          </div>
          <div>
            <label htmlFor={`${uid}-llegada`} className="mb-1 block text-sm font-medium text-navy">Llegada estimada (opcional)</label>
            <Input id={`${uid}-llegada`} type="date" min={f.fechaDespacho} value={f.fechaEstimadaLlegada} onChange={(e) => setF({ ...f, fechaEstimadaLlegada: e.target.value })} />
          </div>
          <div>
            <label htmlFor={`${uid}-guia`} className="mb-1 block text-sm font-medium text-navy">Guía, BL o AWB (opcional)</label>
            <Input id={`${uid}-guia`} maxLength={60} value={f.referenciaDocumento} onChange={(e) => setF({ ...f, referenciaDocumento: e.target.value })} />
          </div>
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-navy">Cantidad que sale en este despacho</legend>
          <ul className="mt-2 space-y-2">
            {conPendiente.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-3">
                <label htmlFor={`${uid}-q-${l.id}`} className="min-w-0 flex-1 text-sm text-navy">
                  <span className="font-medium">{l.sku}</span>
                  <span className="block text-xs text-navy/50">{l.descripcion} · faltan por despachar {formatNumber(pendiente(l))} {l.unidad}</span>
                </label>
                <Input
                  id={`${uid}-q-${l.id}`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  className="w-32"
                  aria-label={`Cantidad de ${l.sku}`}
                  value={cantidades[l.id] ?? ''}
                  onChange={(e) => setCantidades({ ...cantidades, [l.id]: e.target.value })}
                />
              </li>
            ))}
          </ul>
        </fieldset>

        <Button type="submit" disabled={enviando || lineas.length === 0}>{enviando ? 'Registrando…' : 'Registrar despacho'}</Button>
      </form>
    </Card>
  );
}
