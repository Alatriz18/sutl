'use client';

import { FormEvent, useCallback, useEffect, useId, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { extractApiError, formatDate, formatDateTime } from '@/lib/format';
import { useToast } from '@/lib/toast-context';
import { EntidadTarea, EstadoTarea, PrioridadTarea, Tarea, TareaDetalle, User } from '@/types';

const ESTADOS: { value: EstadoTarea; label: string }[] = [
  { value: 'abierta', label: 'Abierta' },
  { value: 'en_curso', label: 'En curso' },
  { value: 'hecha', label: 'Hecha' },
  { value: 'cancelada', label: 'Cancelada' },
];

const PRIORIDAD: Record<PrioridadTarea, { texto: string; clase: string }> = {
  alta: { texto: 'Alta', clase: 'bg-[#B3362B]/10 text-[#B3362B]' },
  media: { texto: 'Media', clase: 'bg-[#C98A2B]/20 text-[#8A5A12]' },
  baja: { texto: 'Baja', clase: 'bg-navy/10 text-navy/70' },
};

const ENTIDADES: { value: EntidadTarea; label: string }[] = [
  { value: 'sku', label: 'SKU' },
  { value: 'orden_compra', label: 'Orden de compra' },
  { value: 'envio', label: 'Envío' },
];

const ACCION_LABEL: Record<string, string> = {
  'tarea.creada': 'creó la tarea',
  'tarea.modificada': 'modificó la tarea',
  'tarea.comentada': 'comentó',
  'tarea.abierta': 'la dejó abierta',
  'tarea.en_curso': 'la puso en curso',
  'tarea.hecha': 'la marcó como hecha',
  'tarea.cancelada': 'la canceló',
};

const campo = 'w-full rounded-md border border-navy/20 bg-white px-3 py-2 text-sm text-navy focus:border-sky focus:outline-none focus:ring-1 focus:ring-sky';

const vencida = (t: Tarea) => !!t.fechaLimite && t.estado !== 'hecha' && t.estado !== 'cancelada' && new Date(t.fechaLimite).getTime() < Date.now();

function NuevaTarea({ usuarios, onCreada, onCancelar }: { usuarios: User[]; onCreada: () => void; onCancelar: () => void }) {
  const id = useId();
  const toast = useToast();
  const [form, setForm] = useState({ titulo: '', descripcion: '', prioridad: 'media' as PrioridadTarea, asignadoAId: '', fechaLimite: '', entidadTipo: '' as '' | EntidadTarea, entidadId: '' });
  const [enviando, setEnviando] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      await api.post('/tasks', {
        titulo: form.titulo,
        prioridad: form.prioridad,
        ...(form.descripcion.trim() ? { descripcion: form.descripcion } : {}),
        ...(form.asignadoAId ? { asignadoAId: form.asignadoAId } : {}),
        ...(form.fechaLimite ? { fechaLimite: new Date(`${form.fechaLimite}T23:59:59`).toISOString() } : {}),
        ...(form.entidadTipo ? { entidadTipo: form.entidadTipo, entidadId: form.entidadId } : {}),
      });
      toast.success('Tarea creada.');
      onCreada();
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo crear la tarea.'));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="mt-4 rounded-lg border border-navy/10 bg-white p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor={`${id}-t`} className="mb-1 block text-sm font-medium text-navy">Qué hay que hacer</label>
          <Input id={`${id}-t`} required maxLength={160} value={form.titulo} onChange={set('titulo')} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`${id}-d`} className="mb-1 block text-sm font-medium text-navy">Detalle <span className="text-navy/50">(opcional)</span></label>
          <textarea id={`${id}-d`} className={campo} rows={2} maxLength={2000} value={form.descripcion} onChange={set('descripcion')} />
        </div>
        <div>
          <label htmlFor={`${id}-r`} className="mb-1 block text-sm font-medium text-navy">Responsable</label>
          <select id={`${id}-r`} className={campo} value={form.asignadoAId} onChange={set('asignadoAId')}>
            <option value="">Sin asignar</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>{u.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-f`} className="mb-1 block text-sm font-medium text-navy">Fecha límite</label>
          <Input id={`${id}-f`} type="date" value={form.fechaLimite} onChange={set('fechaLimite')} />
        </div>
        <div>
          <label htmlFor={`${id}-p`} className="mb-1 block text-sm font-medium text-navy">Prioridad</label>
          <select id={`${id}-p`} className={campo} value={form.prioridad} onChange={set('prioridad')}>
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-e`} className="mb-1 block text-sm font-medium text-navy">Se refiere a <span className="text-navy/50">(opcional)</span></label>
          <div className="flex gap-2">
            <select id={`${id}-e`} className={cn(campo, 'w-40 shrink-0')} value={form.entidadTipo} onChange={set('entidadTipo')}>
              <option value="">Nada en particular</option>
              {ENTIDADES.map((e) => (
                <option key={e.value} value={e.value}>{e.label}</option>
              ))}
            </select>
            {form.entidadTipo && (
              <Input
                aria-label={form.entidadTipo === 'sku' ? 'Código del SKU' : 'Identificador del registro'}
                placeholder={form.entidadTipo === 'sku' ? 'Código del SKU' : 'ID del registro'}
                required
                maxLength={100}
                value={form.entidadId}
                onChange={set('entidadId')}
              />
            )}
          </div>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button type="submit" disabled={enviando}>{enviando ? 'Guardando...' : 'Crear tarea'}</Button>
        <Button type="button" variant="ghost" onClick={onCancelar}>Cancelar</Button>
      </div>
    </form>
  );
}

function Detalle({ id, usuarios, onCambio, onCerrar }: { id: string; usuarios: User[]; onCambio: () => void; onCerrar: () => void }) {
  const toast = useToast();
  const [t, setT] = useState<TareaDetalle | null>(null);
  const [comentario, setComentario] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const idc = useId();

  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  // Sin `toast` en las dependencias: su objeto cambia en cada render del proveedor.
  const cargar = useCallback(() => {
    setErrorCarga(null);
    api
      .get<TareaDetalle>(`/tasks/${id}`)
      .then((r) => setT(r.data))
      .catch((err) => setErrorCarga(extractApiError(err, 'No se pudo cargar la tarea.')));
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function cambiar(cambios: Record<string, unknown>) {
    setOcupado(true);
    try {
      await api.patch(`/tasks/${id}`, cambios);
      cargar();
      onCambio();
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo actualizar la tarea.'));
    } finally {
      setOcupado(false);
    }
  }

  async function comentar(e: FormEvent) {
    e.preventDefault();
    if (!comentario.trim()) return;
    setOcupado(true);
    try {
      await api.post(`/tasks/${id}/comments`, { texto: comentario });
      setComentario('');
      cargar();
      onCambio();
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo enviar el comentario.'));
    } finally {
      setOcupado(false);
    }
  }

  if (errorCarga) {
    return (
      <div role="alert" className="mt-4 rounded-lg border border-navy/10 bg-white p-4 text-sm text-navy/70">
        {errorCarga}{' '}
        <button type="button" className="underline" onClick={cargar}>Reintentar</button>
      </div>
    );
  }
  if (!t) return <Skeleton className="mt-4 h-64" />;
  const cancelada = t.estado === 'cancelada';

  return (
    <section aria-label={`Detalle de la tarea ${t.titulo}`} className="mt-4 rounded-lg border border-navy/10 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-navy">{t.titulo}</h2>
          {t.descripcion && <p className="mt-1 whitespace-pre-line text-sm text-navy/70">{t.descripcion}</p>}
          <p className="mt-1 text-xs text-navy/50">
            Creada por {t.creadoPor.nombre} · {formatDateTime(t.createdAt)}
            {t.entidadTipo && ` · ${ENTIDADES.find((e) => e.value === t.entidadTipo)?.label}: ${t.entidadId}`}
          </p>
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar detalle" className="rounded p-1 text-navy/50 hover:bg-navy/5">
          <X size={18} aria-hidden />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor={`${idc}-es`} className="mb-1 block text-xs font-medium text-navy/70">Estado</label>
          <select id={`${idc}-es`} className={campo} disabled={ocupado} value={t.estado} onChange={(e) => cambiar({ estado: e.target.value })}>
            {ESTADOS.map((e) => (
              <option key={e.value} value={e.value}>{e.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${idc}-re`} className="mb-1 block text-xs font-medium text-navy/70">Responsable</label>
          <select id={`${idc}-re`} className={campo} disabled={ocupado || cancelada} value={t.asignadoAId ?? ''} onChange={(e) => cambiar({ asignadoAId: e.target.value || null })}>
            <option value="">Sin asignar</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>{u.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${idc}-pr`} className="mb-1 block text-xs font-medium text-navy/70">Prioridad</label>
          <select id={`${idc}-pr`} className={campo} disabled={ocupado || cancelada} value={t.prioridad} onChange={(e) => cambiar({ prioridad: e.target.value })}>
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </select>
        </div>
      </div>
      {cancelada && <p className="mt-2 text-xs text-navy/60">Está cancelada: cambia el estado para reabrirla.</p>}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-navy">Comentarios</h3>
          {t.comentarios.length === 0 ? (
            <p className="mt-2 text-sm text-navy/50">Aún no hay comentarios.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {t.comentarios.map((c) => (
                <li key={c.id} className="rounded-md bg-navy/5 px-3 py-2 text-sm text-navy">
                  <p className="whitespace-pre-line">{c.texto}</p>
                  <p className="mt-1 text-xs text-navy/50">{c.autor.nombre} · {formatDateTime(c.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={comentar} className="mt-3 flex gap-2">
            <Input aria-label="Escribe un comentario" placeholder="Escribe un comentario" maxLength={2000} value={comentario} onChange={(e) => setComentario(e.target.value)} />
            <Button type="submit" disabled={ocupado || !comentario.trim()}>Enviar</Button>
          </form>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-navy">Bitácora</h3>
          <ol className="mt-2 space-y-1.5 text-sm">
            {t.bitacora.map((b) => (
              <li key={b.id} className="text-navy/80">
                <span className="font-medium text-navy">{b.user?.nombre ?? 'Sistema'}</span> {ACCION_LABEL[b.accion] ?? b.accion}
                <span className="text-xs text-navy/50"> · {formatDateTime(b.createdAt)}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

export default function TareasPage() {
  const { user } = useAuth();
  const [tareas, setTareas] = useState<Tarea[] | null>(null);
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [soloMias, setSoloMias] = useState(false);
  const [estado, setEstado] = useState<'activas' | EstadoTarea>('activas');
  const [creando, setCreando] = useState(false);
  const [abierta, setAbierta] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setError(null);
    api
      .get<Tarea[]>('/tasks', { params: { ...(soloMias ? { mias: 'true' } : {}), ...(estado !== 'activas' ? { estado } : {}) } })
      .then((r) => setTareas(estado === 'activas' ? r.data.filter((t) => t.estado === 'abierta' || t.estado === 'en_curso') : r.data))
      .catch((err) => setError(extractApiError(err, 'No se pudieron cargar las tareas.')));
  }, [soloMias, estado]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    // Para asignar responsables: solo personal de la empresa. Si no hay permiso, queda vacío.
    api
      .get<User[]>('/users')
      .then((r) => setUsuarios(r.data.filter((u) => u.activo && u.rol !== 'cliente_final')))
      .catch(() => setUsuarios([]));
  }, []);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Tareas</h1>
          <p className="mt-1 text-navy/60">
            Lo que hay que hacer sobre cada operación: quién lo hace, para cuándo y qué se dijo. Todo cambio queda en la bitácora con su autor y su hora.
          </p>
        </div>
        {!creando && (
          <Button className="shrink-0" onClick={() => setCreando(true)}>Nueva tarea</Button>
        )}
      </div>

      {creando && (
        <NuevaTarea
          usuarios={usuarios}
          onCancelar={() => setCreando(false)}
          onCreada={() => {
            setCreando(false);
            cargar();
          }}
        />
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar tareas">
        {([['activas', 'Pendientes'], ['hecha', 'Hechas'], ['cancelada', 'Canceladas']] as const).map(([v, l]) => (
          <button
            key={v}
            type="button"
            aria-pressed={estado === v}
            onClick={() => setEstado(v)}
            className={cn('rounded-full border px-3 py-1 text-sm', estado === v ? 'border-navy bg-navy text-white' : 'border-navy/20 bg-white text-navy hover:bg-navy/5')}
          >
            {l}
          </button>
        ))}
        <label className="ml-2 flex items-center gap-2 text-sm text-navy">
          <input type="checkbox" checked={soloMias} onChange={(e) => setSoloMias(e.target.checked)} />
          Solo las mías
        </label>
      </div>

      {error && !tareas ? (
        <div className="mt-4 rounded-lg border border-navy/10 bg-white p-6 text-center">
          <p className="text-navy/70">{error}</p>
          <Button variant="ghost" className="mt-2" onClick={cargar}>Reintentar</Button>
        </div>
      ) : !tareas ? (
        <Skeleton className="mt-4 h-48" />
      ) : tareas.length === 0 ? (
        <p className="mt-4 rounded-lg border border-navy/10 bg-white p-6 text-center text-navy/60">No hay tareas con este filtro.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-navy/10 bg-white">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Lista de tareas</caption>
            <thead className="bg-navy/5 text-xs uppercase text-navy/60">
              <tr>
                <th scope="col" className="px-4 py-2">Tarea</th>
                <th scope="col" className="px-4 py-2">Prioridad</th>
                <th scope="col" className="px-4 py-2">Responsable</th>
                <th scope="col" className="px-4 py-2">Vence</th>
                <th scope="col" className="px-4 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {tareas.map((t) => (
                <tr key={t.id} className="border-t border-navy/10">
                  <td className="px-4 py-2">
                    <button type="button" className="text-left font-medium text-navy underline-offset-2 hover:underline" onClick={() => setAbierta(abierta === t.id ? null : t.id)}>
                      {t.titulo}
                    </button>
                    {(t._count?.comentarios ?? 0) > 0 && <span className="ml-2 text-xs text-navy/50">{t._count?.comentarios} comentarios</span>}
                  </td>
                  <td className="px-4 py-2">
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', PRIORIDAD[t.prioridad].clase)}>{PRIORIDAD[t.prioridad].texto}</span>
                  </td>
                  <td className="px-4 py-2 text-navy/80">{t.asignadoA ? (t.asignadoAId === user?.userId ? 'Tú' : t.asignadoA.nombre) : <span className="text-navy/40">Sin asignar</span>}</td>
                  <td className="px-4 py-2">
                    {formatDate(t.fechaLimite)}
                    {vencida(t) && <span className="ml-2 rounded-full bg-[#B3362B]/10 px-2 py-0.5 text-xs font-medium text-[#B3362B]">Vencida</span>}
                  </td>
                  <td className="px-4 py-2 text-navy/80">{ESTADOS.find((e) => e.value === t.estado)?.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {abierta && <Detalle key={abierta} id={abierta} usuarios={usuarios} onCambio={cargar} onCerrar={() => setAbierta(null)} />}
    </div>
  );
}
