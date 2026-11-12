'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ConfigOperacion, ModoRecepcionInventario, TenantConfigResponse } from '@/types';

export const MODO_RECEPCION_LABELS: Record<ModoRecepcionInventario, { titulo: string; descripcion: string }> = {
  automatico: {
    titulo: 'Siempre',
    descripcion: 'Toda recepción de OC entra al inventario de SUTL. Quien recibe elige la bodega.',
  },
  a_eleccion: {
    titulo: 'A elección en cada recepción',
    descripcion: 'Quien registra la recepción decide si lo recibido entra al inventario de SUTL.',
  },
  nunca: {
    titulo: 'Nunca',
    descripcion: 'El inventario se lleva en otro sistema (ERP o WMS propio). SUTL controla la OC y su llegada, sin mover stock.',
  },
};

// Lo que la UI asume mientras carga la configuración real. El backend aplica
// siempre la configuración verdadera; esto solo evita una pantalla vacía.
export const CONFIG_POR_DEFECTO: ConfigOperacion = {
  compras: { toleranciaSobreRecepcionPct: 0, diasAlertaAnticipada: 7, exigirFechaConfirmacion: true, vincularEmbarqueDespachaOc: false },
  inventario: { recepcionActualizaInventario: 'a_eleccion', diasCoberturaAlerta: 15 },
  riesgo: { avisarAlPasarARojo: true },
};

// Caché compartida entre pantallas: la configuración cambia poco y varias
// páginas la necesitan. Se refresca al guardar desde la pantalla de configuración.
let cache: TenantConfigResponse | null = null;
let pendiente: Promise<TenantConfigResponse> | null = null;
const suscriptores = new Set<(data: TenantConfigResponse) => void>();

function cargar(): Promise<TenantConfigResponse> {
  if (!pendiente) {
    pendiente = api
      .get<TenantConfigResponse>('/tenant-config')
      .then((res) => {
        cache = res.data;
        suscriptores.forEach((fn) => fn(res.data));
        return res.data;
      })
      .finally(() => {
        pendiente = null;
      });
  }
  return pendiente;
}

export function publicarTenantConfig(data: TenantConfigResponse) {
  cache = data;
  suscriptores.forEach((fn) => fn(data));
}

// Al cerrar sesión: que el próximo usuario (otro tenant) no vea la configuración anterior.
export function limpiarTenantConfig() {
  cache = null;
}

export function useTenantConfig() {
  const [data, setData] = useState<TenantConfigResponse | null>(cache);
  const [error, setError] = useState(false);

  useEffect(() => {
    suscriptores.add(setData);
    if (!cache) {
      cargar().catch(() => setError(true));
    }
    return () => {
      suscriptores.delete(setData);
    };
  }, []);

  const recargar = useCallback(() => {
    setError(false);
    return cargar().catch((e) => {
      setError(true);
      throw e;
    });
  }, []);

  return {
    data,
    config: data?.configuracion ?? CONFIG_POR_DEFECTO,
    cargando: !data && !error,
    error,
    recargar,
  };
}
