'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { api, DEMO_MODE } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { extractApiError, formatDateTime } from '@/lib/format';

interface RegistroBitacora {
  id: string;
  accion: string;
  entidad: string;
  entidadId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: { id: string; nombre: string; email: string } | null;
}

const ENTIDADES = [
  { valor: '', etiqueta: 'Todo' },
  { valor: 'usuario', etiqueta: 'Usuarios, ingresos y segundo factor' },
  { valor: 'tarea', etiqueta: 'Tareas' },
  { valor: 'excepcion', etiqueta: 'Excepciones' },
];

const LIMITE = 200;

export default function BitacoraPage() {
  const id = useId();
  const [registros, setRegistros] = useState<RegistroBitacora[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [entidad, setEntidad] = useState('');
  const [texto, setTexto] = useState('');

  const cargar = useCallback(() => {
    if (DEMO_MODE) return;
    setError(null);
    setRegistros(null);
    api
      .get<RegistroBitacora[]>('/audit', { params: { limite: LIMITE, ...(entidad ? { entidad } : {}) } })
      .then((r) => setRegistros(r.data))
      .catch((err) => setError(extractApiError(err, 'No se pudo cargar la bitácora.')));
  }, [entidad]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Filtro de texto en el navegador sobre lo ya descargado (acción, persona o detalle).
  const visibles = useMemo(() => {
    if (!registros) return [];
    const q = texto.trim().toLowerCase();
    if (!q) return registros;
    return registros.filter((r) =>
      [r.accion, r.user?.nombre, r.user?.email, r.entidadId, r.metadata ? JSON.stringify(r.metadata) : '']
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [registros, texto]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Bitácora de seguridad</h1>
      <p className="mt-1 text-navy/60">
        Registro de quién hizo qué y cuándo: ingresos, cambios de usuarios y de segundo factor, tareas y excepciones. Solo se agrega: nadie puede editarlo ni borrarlo.
      </p>

      {DEMO_MODE ? (
        <p className="mt-6 rounded-lg border border-sky/20 bg-sky/5 px-4 py-3 text-sm text-navy/70">
          La bitácora funciona con la cuenta real y no está disponible en la demostración.
        </p>
      ) : (
        <>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="sm:w-56">
              <label htmlFor={`${id}-e`} className="mb-1 block text-sm font-medium text-navy">Tipo de registro</label>
              <select
                id={`${id}-e`}
                value={entidad}
                onChange={(e) => setEntidad(e.target.value)}
                className="h-10 w-full rounded-md border border-navy/15 bg-white px-3 text-sm text-navy"
              >
                {ENTIDADES.map((o) => (
                  <option key={o.valor} value={o.valor}>{o.etiqueta}</option>
                ))}
              </select>
            </div>
            <div className="sm:w-72">
              <label htmlFor={`${id}-t`} className="mb-1 block text-sm font-medium text-navy">Buscar</label>
              <Input id={`${id}-t`} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Persona, acción o detalle" />
            </div>
          </div>

          {error ? (
            <div className="mt-6 rounded-lg border border-navy/10 bg-white p-6 text-center">
              <p className="text-navy/70">{error}</p>
              <Button variant="ghost" className="mt-2" onClick={cargar}>Reintentar</Button>
            </div>
          ) : !registros ? (
            <Skeleton className="mt-6 h-64" />
          ) : visibles.length === 0 ? (
            <p className="mt-6 rounded-lg border border-navy/10 bg-white p-6 text-center text-navy/60">No hay registros con ese filtro.</p>
          ) : (
            <div className="mt-6 overflow-x-auto rounded-lg border border-navy/10 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-navy/5 text-navy/70">
                  <tr>
                    <th scope="col" className="px-4 py-2 font-medium">Fecha</th>
                    <th scope="col" className="px-4 py-2 font-medium">Persona</th>
                    <th scope="col" className="px-4 py-2 font-medium">Acción</th>
                    <th scope="col" className="px-4 py-2 font-medium">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((r) => (
                    <tr key={r.id} className="border-t border-navy/10 align-top">
                      <td className="whitespace-nowrap px-4 py-2 text-navy/70">{formatDateTime(r.createdAt)}</td>
                      <td className="px-4 py-2 text-navy">{r.user ? `${r.user.nombre} (${r.user.email})` : 'Sistema'}</td>
                      <td className="px-4 py-2 font-mono text-xs text-navy">{r.accion}</td>
                      <td className="max-w-md break-words px-4 py-2 text-xs text-navy/60">
                        {r.metadata ? JSON.stringify(r.metadata) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {registros && registros.length >= LIMITE && (
            <p className="mt-2 text-xs text-navy/50">Se muestran los {LIMITE} registros más recientes.</p>
          )}
        </>
      )}
    </div>
  );
}
