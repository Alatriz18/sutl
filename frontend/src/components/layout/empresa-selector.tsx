'use client';

import { useEffect, useId, useState } from 'react';
import { Building2, Eye } from 'lucide-react';
import { api, DEMO_MODE } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { extractApiError } from '@/lib/format';
import { useToast } from '@/lib/toast-context';

interface Empresa {
  id: string;
  nombre: string;
  propia: boolean;
  soloLectura: boolean;
}

// Para el analista de SUTL: elegir en qué empresa cliente trabaja. Cada cambio queda
// en la bitácora de esa empresa, y el servidor vuelve a comprobar el permiso en cada acción.
export function EmpresaSelector() {
  const id = useId();
  const toast = useToast();
  const { user, cambiarEmpresa } = useAuth();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [cambiando, setCambiando] = useState(false);
  const esAnalista = user?.rol === 'analista_sutl';

  useEffect(() => {
    if (!esAnalista || DEMO_MODE) return;
    api
      .get<{ empresas: Empresa[] }>('/auth/empresas')
      .then((r) => setEmpresas(r.data.empresas))
      .catch(() => setEmpresas([]));
  }, [esAnalista, user?.tenantId]);

  if (!esAnalista) return null;
  const actual = empresas.find((e) => e.id === user?.tenantId);

  async function elegir(tenantId: string) {
    setCambiando(true);
    try {
      await cambiarEmpresa(tenantId);
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo cambiar de empresa.'));
    } finally {
      setCambiando(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Building2 size={16} className="text-navy/50" aria-hidden />
      <label htmlFor={id} className="sr-only">Empresa en la que trabajas</label>
      <select
        id={id}
        value={user?.tenantId}
        disabled={cambiando || empresas.length === 0}
        onChange={(e) => elegir(e.target.value)}
        className="max-w-[12rem] rounded-md border border-navy/15 bg-white px-2 py-1 text-sm text-navy"
      >
        {empresas.length === 0 && <option value={user?.tenantId}>Cargando…</option>}
        {empresas.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nombre}
            {e.propia ? ' (SUTL)' : ''}
          </option>
        ))}
      </select>
      {actual && !actual.propia && actual.soloLectura && (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#C98A2B]/20 px-2 py-0.5 text-xs font-medium text-[#8A5A12]">
          <Eye size={12} aria-hidden /> Solo lectura
        </span>
      )}
    </div>
  );
}
