'use client';

import { FormEvent, useCallback, useEffect, useId, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { extractApiError, formatDateTime } from '@/lib/format';
import { useToast } from '@/lib/toast-context';
import type { MensajePortal } from '@/types/portal';

const MAX = 2000;

// Conversación entre el equipo y un tercero (proveedor o cliente final) sobre una operación.
// Sirve igual del lado del equipo y del lado del externo: el servidor decide qué puede ver cada uno.
export function Conversacion({ tipo, id, titulo = 'Conversación', ayuda }: { tipo: 'orden_compra' | 'envio'; id: string; titulo?: string; ayuda?: string }) {
  const uid = useId();
  const toast = useToast();
  const [mensajes, setMensajes] = useState<MensajePortal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);

  // El toast no entra en las dependencias: su objeto cambia en cada render y provocaría un bucle de carga.
  const cargar = useCallback(() => {
    setError(null);
    api
      .get<MensajePortal[]>(`/portal/mensajes?entidadTipo=${tipo}&entidadId=${encodeURIComponent(id)}`)
      .then((r) => setMensajes(r.data))
      .catch((err) => setError(extractApiError(err, 'No se pudo cargar la conversación.')));
  }, [tipo, id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    setEnviando(true);
    try {
      await api.post('/portal/mensajes', { entidadTipo: tipo, entidadId: id, texto });
      setTexto('');
      cargar();
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo enviar el mensaje.'));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card className="mt-6">
      <CardTitle>{titulo}</CardTitle>
      {ayuda && <p className="mt-1 text-sm text-navy/60">{ayuda}</p>}
      {error ? (
        <div className="mt-3 text-center">
          <p className="text-sm text-navy/70">{error}</p>
          <Button variant="ghost" className="mt-1" onClick={cargar}>Reintentar</Button>
        </div>
      ) : !mensajes ? (
        <Skeleton className="mt-3 h-20" />
      ) : mensajes.length === 0 ? (
        <p className="mt-3 text-sm text-navy/50">Todavía no hay mensajes.</p>
      ) : (
        <ul className="mt-3 space-y-2" aria-label="Mensajes">
          {mensajes.map((m) => (
            <li key={m.id} className={`rounded-lg border px-3 py-2 text-sm ${m.delEquipo ? 'border-sky/20 bg-sky/5' : 'border-navy/10 bg-white'}`}>
              <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-navy/60">
                <span className="font-semibold text-navy">{m.autor.nombre}</span>
                <span>{m.delEquipo ? 'Equipo' : 'Externo'}</span>
                <span>{formatDateTime(m.createdAt)}</span>
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words text-navy">{m.texto}</p>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={enviar} className="mt-4 flex flex-col gap-2">
        <label htmlFor={`${uid}-msg`} className="text-sm font-medium text-navy">Escribir un mensaje</label>
        <textarea
          id={`${uid}-msg`}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={MAX}
          rows={3}
          className="w-full rounded-md border border-navy/20 px-3 py-2 text-sm"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-navy/50">{texto.length}/{MAX}</span>
          <Button type="submit" disabled={enviando || !texto.trim()}>{enviando ? 'Enviando…' : 'Enviar'}</Button>
        </div>
      </form>
    </Card>
  );
}
