'use client';

import { useEffect, useRef, useState } from 'react';
import { api, DEMO_MODE } from './api';
import { getAccessToken } from './token-store';

export type EstadoEnVivo = 'conectando' | 'en_vivo' | 'reconectando' | 'apagado';

// Interpreta el flujo Server-Sent Events (bloques separados por línea en blanco).
export function parsearSse(buffer: string): { mensajes: { evento: string; data: string }[]; resto: string } {
  const bloques = buffer.replace(/\r\n/g, '\n').split('\n\n');
  const resto = bloques.pop() ?? '';
  const mensajes = bloques
    .map((b) => {
      let evento = 'message';
      const datos: string[] = [];
      for (const linea of b.split('\n')) {
        if (linea.startsWith('event:')) evento = linea.slice(6).trim();
        else if (linea.startsWith('data:')) datos.push(linea.slice(5).trimStart());
      }
      return { evento, data: datos.join('\n') };
    })
    .filter((m) => m.data !== '' || m.evento !== 'message');
  return { mensajes, resto };
}

const ESPERA_MIN = 1500;
const ESPERA_MAX = 30_000;

// Mantiene abierta una conexión de tiempo real (SSE) y avisa de cada evento nuevo. Reintenta solo si se corta
// (con espera creciente) y, al volver, avisa con `onReconectar` para recargar lo que pudo perderse. Usa fetch y no
// EventSource porque las rutas del equipo necesitan el encabezado Authorization. En modo demo no hace nada.
export function useEnVivo<T>(path: string | null, onEvento: (e: T) => void, onReconectar?: () => void): EstadoEnVivo {
  const [estado, setEstado] = useState<EstadoEnVivo>(DEMO_MODE || !path ? 'apagado' : 'conectando');
  const evento = useRef(onEvento);
  const reconectar = useRef(onReconectar);
  useEffect(() => {
    evento.current = onEvento;
    reconectar.current = onReconectar;
  });

  useEffect(() => {
    if (DEMO_MODE || !path) return;
    const control = new AbortController();
    let espera = ESPERA_MIN;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let habiaConectado = false;

    async function conectar() {
      try {
        const token = getAccessToken();
        const res = await fetch(`${api.defaults.baseURL}${path}`, {
          headers: { Accept: 'text/event-stream', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          credentials: 'include',
          signal: control.signal,
        });
        if (!res.ok || !res.body) throw new Error(`SSE ${res.status}`);
        setEstado('en_vivo');
        if (habiaConectado) reconectar.current?.();
        habiaConectado = true;
        espera = ESPERA_MIN;
        const lector = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = '';
        for (;;) {
          const { value, done } = await lector.read();
          if (done) break;
          buffer += value;
          const { mensajes, resto } = parsearSse(buffer);
          buffer = resto;
          for (const m of mensajes) {
            if (m.evento !== 'evento') continue;
            try {
              evento.current(JSON.parse(m.data) as T);
            } catch {
              // mensaje mal formado: se ignora
            }
          }
        }
      } catch {
        if (control.signal.aborted) return;
      }
      if (control.signal.aborted) return;
      setEstado('reconectando');
      timer = setTimeout(conectar, espera);
      espera = Math.min(espera * 2, ESPERA_MAX);
    }

    conectar();
    return () => {
      control.abort();
      if (timer) clearTimeout(timer);
    };
  }, [path]);

  return estado;
}
