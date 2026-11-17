'use client';

import { FormEvent, useCallback, useEffect, useId, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { extractApiError, formatDate } from '@/lib/format';
import { useToast } from '@/lib/toast-context';
import { ETIQUETA_TIPO_DOC } from '@/components/documents-checklist';
import type { TipoDocumento } from '@/types';
import type { DocumentoCompartido } from '@/types/documentos';

export type ModoDocumentos = 'equipo' | 'cliente' | 'proveedor';

// Lo que cada externo puede subir (el servidor lo vuelve a validar).
const TIPOS_SUBIDA: Record<'cliente' | 'proveedor', TipoDocumento[]> = {
  cliente: ['otro'],
  proveedor: ['factura', 'packing_list', 'otro'],
};

const ESTADO: Record<DocumentoCompartido['estado'], { texto: string; clase: string }> = {
  pendiente: { texto: 'En revisión', clase: 'bg-sky/10 text-sky' },
  aprobado: { texto: 'Aprobado', clase: 'bg-[#1A7A4C]/10 text-[#1A7A4C]' },
  rechazado: { texto: 'Rechazado', clase: 'bg-[#B3362B]/10 text-[#B3362B]' },
};

// Documentos de un envío compartidos entre la empresa, su cliente final y sus proveedores. El equipo decide con quién
// se comparte cada uno; el cliente y el proveedor ven lo que les compartieron y pueden subir los suyos.
export function DocumentosCompartidos({ shipmentId, modo, titulo }: { shipmentId: string; modo: ModoDocumentos; titulo?: string }) {
  const uid = useId();
  const toast = useToast();
  const archivoRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<DocumentoCompartido[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [f, setF] = useState<{ tipo: TipoDocumento; fechaVencimiento: string }>({ tipo: modo === 'proveedor' ? 'factura' : 'otro', fechaVencimiento: '' });

  const cargar = useCallback(() => {
    setError(null);
    api
      .get<DocumentoCompartido[]>(`/documents/shipment/${shipmentId}`)
      .then((r) => setDocs(r.data))
      .catch((err) => setError(extractApiError(err, 'No se pudieron cargar los documentos.')));
  }, [shipmentId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function compartir(d: DocumentoCompartido, campo: 'visibleCliente' | 'visibleProveedor', valor: boolean) {
    // Se marca al instante y se revierte si el servidor no lo acepta.
    const poner = (v: boolean) => setDocs((lista) => lista && lista.map((x) => (x.id === d.id ? { ...x, [campo]: v } : x)));
    poner(valor);
    try {
      await api.patch(`/documents/${d.id}/compartir`, { [campo]: valor });
    } catch (err) {
      poner(!valor);
      toast.error(extractApiError(err, 'No se pudo cambiar con quién se comparte.'));
    }
  }

  async function descargar(d: DocumentoCompartido) {
    try {
      const res = await api.get(`/documents/${d.id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = d.nombreArchivo;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo descargar el documento.'));
    }
  }

  async function subir(e: FormEvent) {
    e.preventDefault();
    const archivo = archivoRef.current?.files?.[0];
    if (!archivo) return;
    setSubiendo(true);
    try {
      const body = new FormData();
      body.append('tipo', f.tipo);
      if (f.fechaVencimiento) body.append('fechaVencimiento', f.fechaVencimiento);
      body.append('file', archivo);
      await api.post(`/documents/shipment/${shipmentId}/externo`, body);
      if (archivoRef.current) archivoRef.current.value = '';
      setF({ ...f, fechaVencimiento: '' });
      toast.success('Documento enviado. La empresa lo revisará.');
      cargar();
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo subir el documento.'));
    } finally {
      setSubiendo(false);
    }
  }

  const externo = modo !== 'equipo';
  return (
    <Card className="mt-6">
      <CardTitle>{titulo ?? (externo ? 'Documentos' : 'Documentos compartidos')}</CardTitle>
      {!externo && <p className="mt-1 text-sm text-navy/60">Los documentos son internos hasta que los compartas. El cliente final y los proveedores con carga en este envío solo ven lo que marques aquí.</p>}
      {error ? (
        <div className="mt-3 text-center">
          <p className="text-sm text-navy/70">{error}</p>
          <Button variant="ghost" className="mt-1" onClick={cargar}>Reintentar</Button>
        </div>
      ) : docs === null ? (
        <Skeleton className="mt-3 h-20" />
      ) : docs.length === 0 ? (
        <p className="mt-3 text-sm text-navy/50">{externo ? 'Todavía no hay documentos compartidos contigo.' : 'Este envío todavía no tiene documentos.'}</p>
      ) : (
        <ul className="mt-3 divide-y divide-navy/5" aria-label="Documentos del envío">
          {docs.map((d) => (
            <li key={d.id} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-navy">
                  {ETIQUETA_TIPO_DOC[d.tipo]} <span className="font-normal text-navy/50">· versión {d.version}</span>
                </p>
                <p className="truncate text-xs text-navy/60">
                  {d.nombreArchivo}
                  {d.fechaVencimiento ? ` · vence el ${formatDate(d.fechaVencimiento)}` : ''}
                  {d.subidoPor ? ` · subido por ${d.subidoPor.nombre}` : ''}
                  {d.origen ? ` · ${d.origen === 'equipo' ? 'de la empresa' : 'subido por ti'}` : ''}
                </p>
                {d.estado === 'rechazado' && d.motivoRechazo && <p className="text-xs text-[#B3362B]">Motivo: {d.motivoRechazo}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO[d.estado].clase}`}>{ESTADO[d.estado].texto}</span>
                {modo === 'equipo' && (
                  <>
                    <label className="flex items-center gap-1.5 text-xs text-navy">
                      <input type="checkbox" className="h-4 w-4 rounded border-navy/30 text-sky focus:ring-sky" checked={!!d.visibleCliente} onChange={(e) => compartir(d, 'visibleCliente', e.target.checked)} aria-label={`Compartir ${d.nombreArchivo} con el cliente`} />
                      Cliente
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-navy">
                      <input type="checkbox" className="h-4 w-4 rounded border-navy/30 text-sky focus:ring-sky" checked={!!d.visibleProveedor} onChange={(e) => compartir(d, 'visibleProveedor', e.target.checked)} aria-label={`Compartir ${d.nombreArchivo} con proveedores`} />
                      Proveedores
                    </label>
                  </>
                )}
                <Button variant="ghost" onClick={() => descargar(d)} aria-label={`Descargar ${d.nombreArchivo}`}>
                  <Download size={14} aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {externo && (
        <form onSubmit={subir} className="mt-4 grid grid-cols-1 gap-3 border-t border-navy/5 pt-4 sm:grid-cols-3">
          <div>
            <label htmlFor={`${uid}-t`} className="mb-1 block text-sm font-medium text-navy">Tipo</label>
            <select id={`${uid}-t`} value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value as TipoDocumento })} className="h-10 w-full rounded-md border border-navy/20 bg-white px-2 text-sm text-navy">
              {TIPOS_SUBIDA[modo as 'cliente' | 'proveedor'].map((t) => <option key={t} value={t}>{ETIQUETA_TIPO_DOC[t]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={`${uid}-a`} className="mb-1 block text-sm font-medium text-navy">Archivo</label>
            <input id={`${uid}-a`} ref={archivoRef} required type="file" accept=".pdf,.jpg,.jpeg,.png,.xlsx,.doc,.docx" className="w-full rounded-md border border-navy/20 px-3 py-1.5 text-sm file:mr-3 file:rounded file:border-0 file:bg-navy/10 file:px-3 file:py-1 file:text-navy" />
          </div>
          <div>
            <label htmlFor={`${uid}-v`} className="mb-1 block text-sm font-medium text-navy">Vence (opcional)</label>
            <Input id={`${uid}-v`} type="date" value={f.fechaVencimiento} onChange={(e) => setF({ ...f, fechaVencimiento: e.target.value })} />
          </div>
          <div className="sm:col-span-3">
            <Button type="submit" disabled={subiendo}>{subiendo ? 'Enviando…' : 'Subir documento'}</Button>
            <span className="ml-3 text-xs text-navy/50">PDF, imagen, Word o Excel, hasta 10 MB. Queda en revisión de la empresa.</span>
          </div>
        </form>
      )}
    </Card>
  );
}
