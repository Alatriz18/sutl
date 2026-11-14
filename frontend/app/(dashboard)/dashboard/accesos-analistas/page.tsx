'use client';

import { FormEvent, useCallback, useEffect, useId, useState } from 'react';
import { api, DEMO_MODE } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { extractApiError, formatDate } from '@/lib/format';
import { useToast } from '@/lib/toast-context';
import { Tenant, User } from '@/types';

interface Acceso {
  id: string;
  soloLectura: boolean;
  activo: boolean;
  createdAt: string;
  revocadoAt: string | null;
  analyst: { id: string; nombre: string; email: string };
  tenant: { id: string; nombre: string };
}

// Solo el super_admin: qué analistas de SUTL pueden trabajar en qué empresas cliente.
export default function AccesosAnalistasPage() {
  const id = useId();
  const toast = useToast();
  const [accesos, setAccesos] = useState<Acceso[] | null>(null);
  const [analistas, setAnalistas] = useState<User[]>([]);
  const [empresas, setEmpresas] = useState<Tenant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ analystId: '', tenantId: '', soloLectura: true });
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(() => {
    if (DEMO_MODE) return;
    setError(null);
    Promise.all([api.get<Acceso[]>('/analyst-grants'), api.get<User[]>('/users'), api.get<Tenant[]>('/tenants')])
      .then(([g, u, t]) => {
        setAccesos(g.data);
        setAnalistas(u.data.filter((x) => x.rol === 'analista_sutl' && x.activo));
        setEmpresas(t.data.filter((x) => x.activo));
      })
      .catch((err) => setError(extractApiError(err, 'No se pudieron cargar los accesos.')));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function otorgar(e: FormEvent) {
    e.preventDefault();
    setOcupado(true);
    try {
      await api.post('/analyst-grants', form);
      toast.success('Acceso otorgado.');
      setForm((f) => ({ ...f, tenantId: '' }));
      cargar();
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo otorgar el acceso.'));
    } finally {
      setOcupado(false);
    }
  }

  async function revocar(a: Acceso) {
    setOcupado(true);
    try {
      await api.delete(`/analyst-grants/${a.id}`);
      toast.success('Acceso revocado: surte efecto de inmediato.');
      cargar();
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo revocar el acceso.'));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-navy">Accesos de analistas</h1>
      <p className="mt-1 text-navy/60">
        Un analista de SUTL solo trabaja en las empresas cliente que se le asignan aquí. El acceso es de solo lectura salvo que lo cambies a propósito, se puede revocar al instante y cada ingreso queda en la bitácora de la empresa.
      </p>

      {DEMO_MODE ? (
        <p className="mt-6 rounded-lg border border-sky/20 bg-sky/5 px-4 py-3 text-sm text-navy/70">Los accesos de analistas funcionan con la cuenta real y no están disponibles en la demostración.</p>
      ) : error ? (
        <div className="mt-6 rounded-lg border border-navy/10 bg-white p-6 text-center">
          <p className="text-navy/70">{error}</p>
          <Button variant="ghost" className="mt-2" onClick={cargar}>Reintentar</Button>
        </div>
      ) : !accesos ? (
        <Skeleton className="mt-6 h-48" />
      ) : (
        <>
          <Card className="mt-6">
            <CardTitle>Dar acceso</CardTitle>
            {analistas.length === 0 ? (
              <p className="mt-2 text-sm text-navy/60">Todavía no hay analistas. Créalos en Usuarios con el rol «Analista SUTL».</p>
            ) : (
              <form onSubmit={otorgar} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end">
                <div>
                  <label htmlFor={`${id}-a`} className="mb-1 block text-sm font-medium text-navy">Analista</label>
                  <select id={`${id}-a`} required value={form.analystId} onChange={(e) => setForm((f) => ({ ...f, analystId: e.target.value }))} className="h-10 w-full rounded-md border border-navy/15 bg-white px-2 text-sm text-navy">
                    <option value="">Elige…</option>
                    {analistas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor={`${id}-e`} className="mb-1 block text-sm font-medium text-navy">Empresa</label>
                  <select id={`${id}-e`} required value={form.tenantId} onChange={(e) => setForm((f) => ({ ...f, tenantId: e.target.value }))} className="h-10 w-full rounded-md border border-navy/15 bg-white px-2 text-sm text-navy">
                    <option value="">Elige…</option>
                    {empresas.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm text-navy">
                  <input type="checkbox" className="h-4 w-4 rounded border-navy/30 text-sky focus:ring-sky" checked={!form.soloLectura} onChange={(e) => setForm((f) => ({ ...f, soloLectura: !e.target.checked }))} />
                  Permitir modificar datos
                </label>
                <Button type="submit" disabled={ocupado || !form.analystId || !form.tenantId}>Dar acceso</Button>
              </form>
            )}
          </Card>

          <div className="mt-6 overflow-x-auto rounded-lg border border-navy/10 bg-white">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-navy/5 text-navy/70">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">Analista</th>
                  <th scope="col" className="px-4 py-2 font-medium">Empresa</th>
                  <th scope="col" className="px-4 py-2 font-medium">Alcance</th>
                  <th scope="col" className="px-4 py-2 font-medium">Estado</th>
                  <th scope="col" className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {accesos.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-navy/50">Aún no hay accesos otorgados.</td></tr>
                )}
                {accesos.map((a) => (
                  <tr key={a.id} className="border-t border-navy/5">
                    <td className="px-4 py-2 text-navy">{a.analyst.nombre}<span className="block text-xs text-navy/50">{a.analyst.email}</span></td>
                    <td className="px-4 py-2 text-navy">{a.tenant.nombre}</td>
                    <td className="px-4 py-2 text-navy/70">{a.soloLectura ? 'Solo lectura' : 'Puede modificar'}</td>
                    <td className="px-4 py-2 text-navy/70">{a.activo ? `Vigente desde ${formatDate(a.createdAt)}` : `Revocado el ${formatDate(a.revocadoAt)}`}</td>
                    <td className="px-4 py-2 text-right">
                      {a.activo && <Button variant="danger" disabled={ocupado} onClick={() => revocar(a)}>Revocar</Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
