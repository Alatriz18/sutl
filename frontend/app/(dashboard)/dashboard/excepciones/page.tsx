'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { extractApiError, formatDateTime } from '@/lib/format';
import { useToast } from '@/lib/toast-context';
import { Excepcion, ResultadoExcepciones, SeveridadExcepcion } from '@/types';

// El color nunca va solo: cada severidad lleva su texto.
const SEVERIDAD: Record<SeveridadExcepcion, { texto: string; clase: string }> = {
  critica: { texto: 'Crítica · plazo vencido', clase: 'bg-[#B3362B] text-white' },
  alta: { texto: 'Grave', clase: 'bg-[#B3362B]/10 text-[#B3362B]' },
  media: { texto: 'Moderada', clase: 'bg-[#C98A2B]/20 text-[#8A5A12]' },
};

const TIPO: Record<Excepcion['tipo'], string> = {
  sku_en_rojo: 'SKU en rojo',
  oc_atrasada: 'OC atrasada',
};

// Tiempo que falta (o que lleva vencido) respecto del plazo.
function plazo(venceSlaAt: string) {
  const ms = new Date(venceSlaAt).getTime() - Date.now();
  const horas = Math.round(Math.abs(ms) / 3_600_000);
  const texto = horas >= 48 ? `${Math.round(horas / 24)} días` : `${horas} h`;
  return ms >= 0 ? `Vence en ${texto}` : `Vencido hace ${texto}`;
}

export default function ExcepcionesPage() {
  const [lista, setLista] = useState<Excepcion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verResueltas, setVerResueltas] = useState(false);
  const [evaluando, setEvaluando] = useState(false);
  const toast = useToast();

  const cargar = useCallback(() => {
    setError(null);
    api
      .get<Excepcion[]>('/exceptions', { params: verResueltas ? {} : { estado: 'abierta' } })
      .then((r) => setLista(r.data))
      .catch((err) => setError(extractApiError(err, 'No se pudieron cargar las excepciones.')));
  }, [verResueltas]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function evaluar() {
    setEvaluando(true);
    try {
      const r = await api.post<ResultadoExcepciones>('/exceptions/evaluar');
      const { abiertas, resueltas, escaladas } = r.data;
      toast.success(
        abiertas + resueltas + escaladas === 0
          ? 'Evaluado: no hay novedades.'
          : `Evaluado: ${abiertas} nueva(s), ${resueltas} resuelta(s), ${escaladas} escalada(s).`,
      );
      cargar();
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo evaluar.'));
    } finally {
      setEvaluando(false);
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Excepciones</h1>
          <p className="mt-1 text-navy/60">
            Lo que se salió de lo planeado y alguien debe atender antes de que venza su plazo: un SKU que se quedaría sin stock o una OC que no llegó a tiempo. Si el plazo vence y el problema sigue, se escala y se avisa a los administradores. Cuando el problema desaparece, la excepción se cierra sola.
          </p>
        </div>
        <Button variant="secondary" className="shrink-0" disabled={evaluando} onClick={evaluar}>
          {evaluando ? 'Evaluando...' : 'Evaluar ahora'}
        </Button>
      </div>

      <label className="mt-6 flex items-center gap-2 text-sm text-navy">
        <input type="checkbox" checked={verResueltas} onChange={(e) => setVerResueltas(e.target.checked)} />
        Mostrar también las resueltas
      </label>

      {error && !lista ? (
        <div className="mt-4 rounded-lg border border-navy/10 bg-white p-6 text-center">
          <p className="text-navy/70">{error}</p>
          <Button variant="ghost" className="mt-2" onClick={cargar}>Reintentar</Button>
        </div>
      ) : !lista ? (
        <Skeleton className="mt-4 h-48" />
      ) : lista.length === 0 ? (
        <p className="mt-4 rounded-lg border border-navy/10 bg-white p-6 text-center text-navy/60">No hay excepciones abiertas. Todo va según lo planeado.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {lista.map((e) => {
            const abierta = e.estado === 'abierta';
            return (
              <li key={e.id} className={cn('rounded-lg border border-navy/10 bg-white p-4', !abierta && 'opacity-70')}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', abierta ? SEVERIDAD[e.severidad].clase : 'bg-[#1A7A4C]/10 text-[#1A7A4C]')}>
                    {abierta ? SEVERIDAD[e.severidad].texto : 'Resuelta'}
                  </span>
                  <span className="text-xs text-navy/50">{TIPO[e.tipo]}</span>
                  <h2 className="font-semibold text-navy">{e.titulo}</h2>
                </div>
                <p className="mt-1 text-sm text-navy/70">{e.detalle}</p>
                <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-navy/60">
                  {abierta ? <span className="font-medium text-navy">{plazo(e.venceSlaAt)}</span> : <span>Resuelta el {formatDateTime(e.resueltaAt)}</span>}
                  <span>Detectada el {formatDateTime(e.createdAt)}</span>
                  {e.taskId && abierta && (
                    <Link href="/dashboard/tareas" className="font-medium text-sky underline-offset-2 hover:underline">
                      Ver la tarea
                    </Link>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
