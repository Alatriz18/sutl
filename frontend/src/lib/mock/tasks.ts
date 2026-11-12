import { ComentarioTarea, EventoBitacora, PersonaResumen, Tarea, TareaDetalle, User } from '@/types';
import { MockApiError } from './errors';

// Tareas del modo demo (en memoria): replican las reglas del backend para que
// la demo se comporte igual — responsable de la misma empresa, tarea cancelada
// bloqueada, operador solo toca lo suyo y bitácora de cada cambio.

interface Registro {
  tarea: Tarea;
  tenantId: string;
  comentarios: ComentarioTarea[];
  bitacora: EventoBitacora[];
}

const registros: Registro[] = [];
let semilla = false;
let contador = 100;

const persona = (u: User): PersonaResumen => ({ id: u.id, nombre: u.nombre, email: u.email });
const ahora = () => new Date().toISOString();
const id = (p: string) => `${p}-${++contador}`;

function evento(accion: string, u: User, metadata: Record<string, unknown> | null = null): EventoBitacora {
  return { id: id('b'), accion, metadata, createdAt: ahora(), user: persona(u) };
}

function sembrar(usuarios: User[]) {
  if (semilla) return;
  semilla = true;
  const admin = usuarios.find((u) => u.rol === 'admin_tenant') ?? usuarios[0];
  if (!admin) return;
  const dia = 86400000;
  const crear = (titulo: string, prioridad: Tarea['prioridad'], diasLimite: number, entidadTipo: Tarea['entidadTipo'], entidadId: string | null) => {
    const t: Tarea = {
      id: id('k'), titulo, descripcion: null, estado: 'abierta', prioridad, asignadoAId: admin.id, asignadoA: persona(admin),
      creadoPorId: admin.id, creadoPor: persona(admin), fechaLimite: new Date(Date.now() + diasLimite * dia).toISOString(), completadaAt: null,
      entidadTipo, entidadId, createdAt: ahora(), updatedAt: ahora(), _count: { comentarios: 0 },
    };
    registros.push({ tarea: t, tenantId: admin.tenantId, comentarios: [], bitacora: [evento('tarea.creada', admin, { titulo })] });
  };
  crear('Confirmar fecha de llegada con el proveedor', 'alta', 2, 'sku', 'RES-PET-001');
  crear('Revisar documentos de la OC antes del embarque', 'media', 5, null, null);
}

function detalle(r: Registro): TareaDetalle {
  return { ...r.tarea, _count: { comentarios: r.comentarios.length }, comentarios: r.comentarios, bitacora: r.bitacora };
}

// Devuelve undefined si la ruta no es de tareas.
export function manejarTareas(
  method: string,
  path: string,
  query: Record<string, unknown>,
  body: Record<string, unknown>,
  user: User,
  usuarios: User[],
): { data: unknown; status?: number } | undefined {
  const esTareas = path === '/tasks' || path.startsWith('/tasks/');
  if (!esTareas) return undefined;
  sembrar(usuarios.filter((u) => u.tenantId === user.tenantId));
  const propias = registros.filter((r) => r.tenantId === user.tenantId);
  const esAdmin = user.rol === 'admin_tenant' || user.rol === 'super_admin';

  if (method === 'get' && path === '/tasks') {
    let lista = propias;
    if (query.estado) lista = lista.filter((r) => r.tarea.estado === query.estado);
    if (query.mias === 'true') lista = lista.filter((r) => r.tarea.asignadoAId === user.id);
    return {
      data: lista
        .map((r) => ({ ...r.tarea, _count: { comentarios: r.comentarios.length } }))
        .sort((a, b) => (a.fechaLimite ?? '9999').localeCompare(b.fechaLimite ?? '9999')),
    };
  }

  if (method === 'post' && path === '/tasks') {
    const titulo = String(body.titulo ?? '').trim();
    if (!titulo) throw new MockApiError(400, 'titulo should not be empty');
    let asignado: User | undefined;
    if (body.asignadoAId) {
      asignado = usuarios.find((u) => u.id === body.asignadoAId && u.tenantId === user.tenantId && u.activo);
      if (!asignado) throw new MockApiError(404, 'Usuario no encontrado');
      if (asignado.rol === 'cliente_final') throw new MockApiError(400, 'Una tarea no se puede asignar a un cliente final');
    }
    const tarea: Tarea = {
      id: id('k'), titulo, descripcion: String(body.descripcion ?? '').trim() || null, estado: 'abierta',
      prioridad: (body.prioridad as Tarea['prioridad']) ?? 'media', asignadoAId: asignado?.id ?? null, asignadoA: asignado ? persona(asignado) : null,
      creadoPorId: user.id, creadoPor: persona(user), fechaLimite: body.fechaLimite ? String(body.fechaLimite) : null, completadaAt: null,
      entidadTipo: (body.entidadTipo as Tarea['entidadTipo']) ?? null, entidadId: body.entidadTipo ? String(body.entidadId ?? '') || null : null,
      createdAt: ahora(), updatedAt: ahora(), _count: { comentarios: 0 },
    };
    registros.push({ tarea, tenantId: user.tenantId, comentarios: [], bitacora: [evento('tarea.creada', user, { titulo })] });
    return { data: tarea, status: 201 };
  }

  const m = path.match(/^\/tasks\/([^/]+)(\/comments)?$/);
  if (!m) return undefined;
  const reg = propias.find((r) => r.tarea.id === m[1]);
  if (!reg) throw new MockApiError(404, 'Tarea no encontrada');

  if (method === 'get' && !m[2]) return { data: detalle(reg) };

  if (method === 'post' && m[2]) {
    const texto = String(body.texto ?? '').trim();
    if (!texto) throw new MockApiError(400, 'texto should not be empty');
    const c: ComentarioTarea = { id: id('c'), texto, createdAt: ahora(), autor: persona(user) };
    reg.comentarios.push(c);
    reg.bitacora.push(evento('tarea.comentada', user, { comentarioId: c.id }));
    return { data: c, status: 201 };
  }

  if (method === 'patch' && !m[2]) {
    const t = reg.tarea;
    if (!esAdmin && t.creadoPorId !== user.id && t.asignadoAId !== user.id) {
      throw new MockApiError(403, 'Solo quien creó la tarea, su responsable o un administrador pueden modificarla');
    }
    if (t.estado === 'cancelada' && (body.estado === undefined || body.estado === 'cancelada')) {
      throw new MockApiError(409, 'La tarea está cancelada: reábrela antes de modificarla');
    }
    const cambios: Record<string, { de: unknown; a: unknown }> = {};
    const poner = (campo: keyof Tarea, nuevo: unknown) => {
      if (nuevo === undefined || nuevo === t[campo]) return;
      cambios[campo] = { de: t[campo], a: nuevo };
      (t as unknown as Record<string, unknown>)[campo] = nuevo;
    };
    if (body.asignadoAId !== undefined) {
      const asignado = body.asignadoAId ? usuarios.find((u) => u.id === body.asignadoAId && u.tenantId === user.tenantId && u.activo) : null;
      if (body.asignadoAId && !asignado) throw new MockApiError(404, 'Usuario no encontrado');
      if (asignado?.rol === 'cliente_final') throw new MockApiError(400, 'Una tarea no se puede asignar a un cliente final');
      if ((asignado?.id ?? null) !== t.asignadoAId) {
        cambios.asignadoAId = { de: t.asignadoAId, a: asignado?.id ?? null };
        t.asignadoAId = asignado?.id ?? null;
        t.asignadoA = asignado ? persona(asignado) : null;
      }
    }
    if (typeof body.titulo === 'string') poner('titulo', body.titulo.trim());
    if (typeof body.descripcion === 'string') poner('descripcion', body.descripcion.trim());
    poner('prioridad', body.prioridad);
    if (body.fechaLimite !== undefined) poner('fechaLimite', body.fechaLimite ? String(body.fechaLimite) : null);
    if (body.estado !== undefined && body.estado !== t.estado) {
      cambios.estado = { de: t.estado, a: body.estado };
      t.estado = body.estado as Tarea['estado'];
      t.completadaAt = t.estado === 'hecha' ? ahora() : null;
    }
    if (Object.keys(cambios).length > 0) {
      t.updatedAt = ahora();
      reg.bitacora.push(evento(cambios.estado ? `tarea.${String(cambios.estado.a)}` : 'tarea.modificada', user, { cambios }));
    }
    return { data: { ...t, _count: { comentarios: reg.comentarios.length } } };
  }

  return undefined;
}
