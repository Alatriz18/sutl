'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { extractApiError, formatDate } from '@/lib/format';
import { useToast } from '@/lib/toast-context';
import { ChecklistEnvio, EstadoItemChecklist, ItemChecklist, TipoDocumento } from '@/types';

export const ETIQUETA_TIPO_DOC: Record<TipoDocumento, string> = {
  bl: 'Conocimiento de embarque (BL)',
  awb: 'Guía aérea (AWB)',
  factura: 'Factura',
  pedimento: 'Pedimento',
  packing_list: 'Lista de empaque',
  otro: 'Otro documento',
};

// El color nunca va solo: cada estado lleva su texto.
export const ESTADO_DOC: Record<EstadoItemChecklist, { texto: string; clase: string }> = {
  faltante: { texto: 'Falta', clase: 'bg-[#B3362B]/10 text-[#B3362B]' },
  pendiente: { texto: 'Pendiente de revisión', clase: 'bg-sky/10 text-sky' },
  aprobado: { texto: 'Aprobado', clase: 'bg-[#1A7A4C]/10 text-[#1A7A4C]' },
  rechazado: { texto: 'Rechazado', clase: 'bg-[#B3362B]/10 text-[#B3362B]' },
  vencido: { texto: 'Vencido', clase: 'bg-[#B3362B]/10 text-[#B3362B]' },
  por_vencer: { texto: 'Por vencer', clase: 'bg-[#C98A2B]/20 text-[#8A5A12]' },
};

// Documentos exigidos para un envío según la configuración de la empresa,
// con su estado y, para quien puede, la revisión (aprobar o rechazar).
export function DocumentsChecklist({ shipmentId }: { shipmentId: string }) {
  const toast = useToast();
  const { user } = useAuth();
  const puedeRevisar = user?.rol === 'admin_tenant' || user?.rol === 'operador' || user?.rol === 'super_admin' || user?.rol === 'analista_sutl';
  const [datos, setDatos] = useState<ChecklistEnvio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rechazando, setRechazando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);

  // El toast no se usa aquí para evitar un bucle: su objeto cambia en cada render.
  const cargar = useCallback(() => {
    setError(null);
    api
      .get<ChecklistEnvio>(`/documents/checklist/${shipmentId}`)
      .then((r) => setDatos(r.data))
      .catch((err) => setError(extractApiError(err, 'No se pudo cargar el checklist de documentos.')));
  }, [shipmentId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function revisar(id: string, estado: 'aprobado' | 'rechazado', motivoRechazo?: string) {
    setOcupado(true);
    try {
      await api.patch(`/documents/${id}/revision`, { estado, ...(motivoRechazo ? { motivoRechazo } : {}) });
      toast.success(estado === 'aprobado' ? 'Documento aprobado.' : 'Documento rechazado.');
      setRechazando(null);
      setMotivo('');
      cargar();
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo registrar la revisión.'));
    } finally {
      setOcupado(false);
    }
  }

  function confirmarRechazo(e: FormEvent, id: string) {
    e.preventDefault();
    return revisar(id, 'rechazado', motivo.trim());
  }

  // El cliente final no gestiona documentos internos.
  if (user?.rol === 'cliente_final' || user?.rol === 'proveedor') return null;

  function Fila({ i }: { i: ItemChecklist }) {
    const e = ESTADO_DOC[i.estado];
    const doc = i.documento;
    return (
      <li className="py-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-navy">{ETIQUETA_TIPO_DOC[i.tipo]}</p>
            <p className="text-xs text-navy/60">
              {doc ? `${doc.nombreArchivo} · versión ${doc.version}` : 'Sin archivo'}
              {doc?.fechaVencimiento ? ` · vence el ${formatDate(doc.fechaVencimiento)}` : ''}
            </p>
            {i.estado === 'rechazado' && doc?.motivoRechazo && <p className="text-xs text-[#B3362B]">Motivo: {doc.motivoRechazo}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${e.clase}`}>{e.texto}</span>
            {puedeRevisar && doc && (i.estado === 'pendiente' || i.estado === 'rechazado') && (
              <Button variant="secondary" disabled={ocupado} onClick={() => revisar(doc.id, 'aprobado')}>Aprobar</Button>
            )}
            {puedeRevisar && doc && i.estado === 'pendiente' && (
              <Button variant="ghost" disabled={ocupado} onClick={() => { setRechazando(doc.id); setMotivo(''); }}>Rechazar</Button>
            )}
          </div>
        </div>
        {doc && rechazando === doc.id && (
          <form onSubmit={(ev) => confirmarRechazo(ev, doc.id)} className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor={`motivo-${doc.id}`} className="mb-1 block text-xs font-medium text-navy">Motivo del rechazo</label>
              <Input id={`motivo-${doc.id}`} required maxLength={500} value={motivo} onChange={(ev) => setMotivo(ev.target.value)} placeholder="Ej. El archivo está ilegible" />
            </div>
            <Button type="submit" variant="danger" disabled={ocupado || !motivo.trim()}>Confirmar rechazo</Button>
            <Button type="button" variant="ghost" onClick={() => setRechazando(null)}>Cancelar</Button>
          </form>
        )}
      </li>
    );
  }

  return (
    <Card className="mt-6">
      <div className="flex items-start justify-between gap-3">
        <CardTitle>Documentos del envío</CardTitle>
        {datos && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${datos.completo ? 'bg-[#1A7A4C]/10 text-[#1A7A4C]' : 'bg-[#C98A2B]/20 text-[#8A5A12]'}`}>
            {datos.completo ? 'Documentación completa' : 'Documentación incompleta'}
          </span>
        )}
      </div>
      {error ? (
        <div className="mt-3 text-center">
          <p className="text-sm text-navy/70">{error}</p>
          <Button variant="ghost" className="mt-1" onClick={cargar}>Reintentar</Button>
        </div>
      ) : !datos ? (
        <Skeleton className="mt-3 h-24" />
      ) : (
        <>
          {datos.items.length === 0 ? (
            <p className="mt-3 text-sm text-navy/50">La configuración de tu empresa no exige documentos para este envío.</p>
          ) : (
            <ul className="mt-2 divide-y divide-navy/5">{datos.items.map((i) => <Fila key={i.tipo} i={i} />)}</ul>
          )}
          {datos.extras.length > 0 && (
            <>
              <h3 className="mt-4 text-sm font-semibold text-navy">Otros documentos subidos</h3>
              <ul className="divide-y divide-navy/5">{datos.extras.map((i) => <Fila key={i.tipo} i={i} />)}</ul>
            </>
          )}
          <Link href="/dashboard/documentos" className="mt-3 inline-block text-sm font-medium text-sky hover:underline">
            Subir un documento
          </Link>
        </>
      )}
    </Card>
  );
}
