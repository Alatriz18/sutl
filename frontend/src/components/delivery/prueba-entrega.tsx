'use client';

import { FormEvent, useCallback, useEffect, useId, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { FirmaPad, type FirmaPadHandle } from './firma-pad';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { extractApiError, formatDateTime } from '@/lib/format';
import { useTenantConfig } from '@/lib/tenant-config';
import { useToast } from '@/lib/toast-context';
import type { PruebaEntrega, ResultadoRegistroPod } from '@/types/entrega';
import type { Warehouse } from '@/types';

// Prueba de entrega de un envío. El equipo la registra (con evidencia y, si quiere, recibe las órdenes
// de compra); el cliente final solo la consulta.
export function PruebaEntregaCard({ shipmentId, modo, onRegistrada }: { shipmentId: string; modo: 'equipo' | 'cliente'; onRegistrada?: () => void }) {
  const uid = useId();
  const toast = useToast();
  const { config } = useTenantConfig();
  const archivoRef = useRef<HTMLInputElement>(null);
  const fotoRef = useRef<HTMLInputElement>(null);
  const [fotoNombre, setFotoNombre] = useState('');
  const firmaRef = useRef<FirmaPadHandle>(null);
  const [firmaUrl, setFirmaUrl] = useState<string | null>(null);
  const [pod, setPod] = useState<PruebaEntrega | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [bodegas, setBodegas] = useState<Warehouse[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoRegistroPod['recepciones']>([]);
  const [f, setF] = useState({ receptorNombre: '', receptorDocumento: '', entregadoAt: '', observaciones: '', recibirOc: false, actualizarInventario: false, warehouseId: '' });

  // El toast queda fuera de las dependencias: su objeto cambia en cada render y provocaría un bucle de carga.
  const cargar = useCallback(() => {
    setError(null);
    api
      .get<PruebaEntrega | '' | null>(`/shipments/${shipmentId}/pod`)
      // Sin prueba, el servidor responde sin cuerpo (o con un objeto vacío en la demo).
      .then((r) => setPod(r.data && typeof r.data === 'object' && 'id' in r.data ? r.data : null))
      .catch((err) => setError(extractApiError(err, 'No se pudo cargar la prueba de entrega.')));
  }, [shipmentId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // La firma se pide con la sesión (no es una dirección pública): se baja como imagen y se muestra desde memoria.
  const tieneFirma = !!(pod && pod.tieneFirma);
  useEffect(() => {
    if (!tieneFirma) return;
    let url: string | null = null;
    let cancelado = false;
    api
      .get(`/shipments/${shipmentId}/pod/firma`, { responseType: 'blob' })
      .then((r) => {
        if (cancelado) return;
        url = URL.createObjectURL(r.data);
        setFirmaUrl(url);
      })
      .catch(() => setFirmaUrl(null));
    return () => {
      cancelado = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [tieneFirma, shipmentId]);

  const modoInventario = config.inventario.recepcionActualizaInventario;
  const mueveInventario = f.recibirOc && (modoInventario === 'automatico' || (modoInventario === 'a_eleccion' && f.actualizarInventario));
  useEffect(() => {
    if (modo !== 'equipo' || !f.recibirOc || modoInventario === 'nunca' || bodegas.length > 0) return;
    api.get<Warehouse[]>('/warehouses').then((r) => setBodegas(r.data)).catch(() => setBodegas([]));
  }, [modo, f.recibirOc, modoInventario, bodegas.length]);

  async function registrar(e: FormEvent) {
    e.preventDefault();
    setGuardando(true);
    try {
      const body = new FormData();
      body.append('receptorNombre', f.receptorNombre);
      if (f.receptorDocumento) body.append('receptorDocumento', f.receptorDocumento);
      if (f.entregadoAt) body.append('entregadoAt', new Date(f.entregadoAt).toISOString());
      if (f.observaciones) body.append('observaciones', f.observaciones);
      if (f.recibirOc) {
        body.append('recibirOc', 'true');
        if (modoInventario === 'a_eleccion') body.append('actualizarInventario', String(f.actualizarInventario));
        if (mueveInventario && f.warehouseId) body.append('warehouseId', f.warehouseId);
      }
      // La foto tomada con la cámara tiene prioridad sobre el archivo elegido.
      const archivo = fotoRef.current?.files?.[0] ?? archivoRef.current?.files?.[0];
      if (archivo) body.append('evidencia', archivo);
      const firma = await firmaRef.current?.aPng();
      if (firma) body.append('firma', firma, 'firma.png');
      const r = await api.post<ResultadoRegistroPod>(`/shipments/${shipmentId}/pod`, body);
      setPod(r.data.pod);
      setResultado(r.data.recepciones);
      toast.success('Prueba de entrega registrada.');
      onRegistrada?.();
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo registrar la prueba de entrega.'));
    } finally {
      setGuardando(false);
    }
  }

  async function descargar() {
    try {
      const res = await api.get(`/shipments/${shipmentId}/pod/evidencia`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = pod?.archivoNombre ?? 'evidencia';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo descargar la evidencia.'));
    }
  }

  return (
    <Card className="mt-6">
      <CardTitle>Prueba de entrega</CardTitle>
      {error ? (
        <div className="mt-3 text-center">
          <p className="text-sm text-navy/70">{error}</p>
          <Button variant="ghost" className="mt-1" onClick={cargar}>Reintentar</Button>
        </div>
      ) : pod === undefined ? (
        <Skeleton className="mt-3 h-20" />
      ) : pod ? (
        <div className="mt-3 text-sm">
          <dl className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
            {([
              ['Recibió', pod.receptorNombre],
              ['Documento', pod.receptorDocumento ?? '—'],
              ['Entregado el', formatDateTime(pod.entregadoAt)],
              ...(modo === 'equipo' ? ([['Registrado por', pod.registradoPor.nombre]] as const) : []),
            ] as const).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-navy/5 py-1">
                <dt className="text-navy/60">{k}</dt>
                <dd className="font-medium text-navy">{v}</dd>
              </div>
            ))}
          </dl>
          {pod.observaciones && <p className="mt-3 text-navy/80">{pod.observaciones}</p>}
          {pod.tieneFirma && (
            <figure className="mt-3">
              {firmaUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={firmaUrl} alt={`Firma de ${pod.receptorNombre}`} className="h-24 rounded-md border border-navy/10 bg-white" />
              ) : (
                <Skeleton className="h-24 w-48" />
              )}
              <figcaption className="mt-1 text-xs text-navy/50">Firma de quien recibió</figcaption>
            </figure>
          )}
          {pod.tieneArchivo && (
            <Button variant="secondary" className="mt-3" onClick={descargar}>
              <Download size={14} aria-hidden /> Descargar evidencia
            </Button>
          )}
          {resultado.length > 0 && (
            <ul className="mt-3 space-y-1" aria-label="Recepción de órdenes de compra">
              {resultado.map((r) => (
                <li key={r.numero} className={r.ok ? 'text-[#1A7A4C]' : 'text-[#B3362B]'}>
                  {r.ok ? `La orden ${r.numero} recibió la carga de este envío.` : `La orden ${r.numero} no se pudo recibir: ${r.error}`}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : modo === 'cliente' ? (
        <p className="mt-3 text-sm text-navy/50">Todavía no se registra la entrega de este envío.</p>
      ) : (
        <form onSubmit={registrar} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <p className="text-sm text-navy/60 sm:col-span-2">Al registrarla, el envío pasa a «Entregado» y queda constancia de quién recibió.</p>
          <div>
            <label htmlFor={`${uid}-n`} className="mb-1 block text-sm font-medium text-navy">Quién recibió</label>
            <Input id={`${uid}-n`} required maxLength={120} value={f.receptorNombre} onChange={(e) => setF({ ...f, receptorNombre: e.target.value })} />
          </div>
          <div>
            <label htmlFor={`${uid}-d`} className="mb-1 block text-sm font-medium text-navy">Documento (opcional)</label>
            <Input id={`${uid}-d`} maxLength={40} value={f.receptorDocumento} onChange={(e) => setF({ ...f, receptorDocumento: e.target.value })} />
          </div>
          <div>
            <label htmlFor={`${uid}-f`} className="mb-1 block text-sm font-medium text-navy">Fecha y hora (por defecto, ahora)</label>
            <Input id={`${uid}-f`} type="datetime-local" max={new Date().toISOString().slice(0, 16)} value={f.entregadoAt} onChange={(e) => setF({ ...f, entregadoAt: e.target.value })} />
          </div>
          <div>
            <label htmlFor={`${uid}-e`} className="mb-1 block text-sm font-medium text-navy">Evidencia (foto o PDF, opcional)</label>
            <span className="mb-1 block text-xs text-navy/50">Desde el celular puedes tomar la foto en el momento con la cámara.</span>
            <label htmlFor={`${uid}-c`} className="mb-2 inline-flex cursor-pointer items-center rounded-md bg-navy/10 px-3 py-1.5 text-sm font-medium text-navy hover:bg-navy/15">
              Tomar foto con la cámara
            </label>
            <input id={`${uid}-c`} ref={fotoRef} type="file" accept="image/jpeg,image/png" capture="environment" className="sr-only" onChange={(e) => setFotoNombre(e.target.files?.[0]?.name ?? '')} />
            {fotoNombre && <span className="mb-2 ml-2 text-xs text-navy/70">Foto lista: {fotoNombre}</span>}
            <input id={`${uid}-e`} ref={archivoRef} type="file" accept=".pdf,.jpg,.jpeg,.png,image/jpeg,image/png" className="w-full rounded-md border border-navy/20 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-navy/10 file:px-3 file:py-1.5 file:text-navy" />
          </div>
          <div className="sm:col-span-2">
            <FirmaPad ref={firmaRef} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor={`${uid}-o`} className="mb-1 block text-sm font-medium text-navy">Observaciones (opcional)</label>
            <Input id={`${uid}-o`} maxLength={1000} value={f.observaciones} onChange={(e) => setF({ ...f, observaciones: e.target.value })} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label className="flex items-start gap-2 text-sm text-navy">
              <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-navy/30 text-sky focus:ring-sky" checked={f.recibirOc} onChange={(e) => setF({ ...f, recibirOc: e.target.checked })} />
              <span>
                Recibir en las órdenes de compra la carga de este envío
                <span className="block text-xs text-navy/50">Registra la recepción de lo que viajaba (sin pasar de lo que falta por recibir).</span>
              </span>
            </label>
            {f.recibirOc && modoInventario === 'a_eleccion' && (
              <label className="ml-6 flex items-center gap-2 text-sm text-navy">
                <input type="checkbox" className="h-4 w-4 rounded border-navy/30 text-sky focus:ring-sky" checked={f.actualizarInventario} onChange={(e) => setF({ ...f, actualizarInventario: e.target.checked })} />
                Sumar lo recibido al inventario
              </label>
            )}
            {mueveInventario && (
              <div className="ml-6">
                <label htmlFor={`${uid}-w`} className="mb-1 block text-sm font-medium text-navy">Bodega de destino</label>
                <select id={`${uid}-w`} required value={f.warehouseId} onChange={(e) => setF({ ...f, warehouseId: e.target.value })} className="h-10 w-full max-w-xs rounded-md border border-navy/20 bg-white px-2 text-sm text-navy">
                  <option value="">Elige…</option>
                  {bodegas.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={guardando || !f.receptorNombre.trim()}>{guardando ? 'Registrando…' : 'Registrar entrega'}</Button>
          </div>
        </form>
      )}
    </Card>
  );
}
