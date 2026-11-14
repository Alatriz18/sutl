import type { MensajePortal } from '@/types/portal';
import { User } from '@/types';
import { MockApiError } from './errors';

// Conversación del portal en modo demo (en memoria). En la demo solo existe el lado del
// equipo; las reglas de proveedor y cliente final las prueba el backend real.

interface Guardado extends MensajePortal {
  clave: string;
  tenantId: string;
}

const mensajes: Guardado[] = [];
let contador = 0;
const ENTIDADES = ['orden_compra', 'envio'];

const claveDe = (tipo: unknown, id: unknown) => {
  if (!ENTIDADES.includes(String(tipo)) || !id) throw new MockApiError(400, 'Indica la operación de la conversación');
  return `${tipo}:${id}`;
};

export function listarMensajes(user: User, tipo: unknown, id: unknown): MensajePortal[] {
  const clave = claveDe(tipo, id);
  return mensajes
    .filter((m) => m.clave === clave && m.tenantId === user.tenantId)
    .map(({ clave: _c, tenantId: _t, ...m }) => {
      void _c;
      void _t;
      return m;
    });
}

export function publicarMensaje(user: User, body: Record<string, unknown>): MensajePortal {
  const clave = claveDe(body.entidadTipo, body.entidadId);
  const texto = String(body.texto ?? '').trim();
  if (!texto) throw new MockApiError(400, 'Escribe un mensaje');
  if (texto.length > 2000) throw new MockApiError(400, 'El mensaje es demasiado largo');
  const m: Guardado = { id: `pm-${++contador}`, clave, tenantId: user.tenantId, texto, createdAt: new Date().toISOString(), autor: { id: user.id, nombre: user.nombre }, delEquipo: true };
  mensajes.push(m);
  const { clave: _c, tenantId: _t, ...publico } = m;
  void _c;
  void _t;
  return publico;
}
