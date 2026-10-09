'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardTitle } from '@/components/ui/card';
import { TableSkeleton } from '@/components/ui/skeleton';
import { useToast } from '@/lib/toast-context';
import { extractApiError } from '@/lib/format';
import { Tenant } from '@/types';

const PLANES = ['trial', 'basico', 'pro'];

export default function TenantsPage() {
  const toast = useToast();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ nombre: '', ruc: '', plan: 'trial' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function cargar() {
    setLoading(true);
    const res = await api.get<Tenant[]>('/tenants');
    setTenants(res.data);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.post('/tenants', { ...form, ruc: form.ruc || undefined });
      setForm({ nombre: '', ruc: '', plan: 'trial' });
      toast.success('Tenant creado correctamente.');
      await cargar();
    } catch (err) {
      setError(extractApiError(err, 'No se pudo crear el tenant.'));
    } finally {
      setSaving(false);
    }
  }

  async function cambiarPlan(t: Tenant, plan: string) {
    setBusyId(t.id);
    try {
      await api.patch(`/tenants/${t.id}`, { plan });
      toast.success(`Plan de ${t.nombre} actualizado a ${plan}.`);
      await cargar();
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo actualizar el plan.'));
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActivo(t: Tenant) {
    setBusyId(t.id);
    try {
      if (t.activo) {
        await api.delete(`/tenants/${t.id}`);
        toast.success(`${t.nombre} fue desactivado.`);
      } else {
        await api.patch(`/tenants/${t.id}`, { activo: true });
        toast.success(`${t.nombre} fue reactivado.`);
      }
      await cargar();
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo actualizar el estado del tenant.'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Empresas (tenants)</h1>
      <p className="mt-1 text-navy/60">Panel SaaS — exclusivo de super_admin.</p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="overflow-x-auto rounded-lg border border-navy/10 bg-white">
            {loading ? (
              <TableSkeleton rows={3} cols={4} />
            ) : (
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-navy/5 text-navy/70">
                  <tr>
                    <th className="px-4 py-3 font-medium">Nombre</th>
                    <th className="px-4 py-3 font-medium">RUC</th>
                    <th className="px-4 py-3 font-medium">Plan</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-navy/50">
                        Aún no hay tenants.
                      </td>
                    </tr>
                  )}
                  {tenants.map((t) => (
                    <tr key={t.id} className="border-t border-navy/5">
                      <td className="px-4 py-3">{t.nombre}</td>
                      <td className="px-4 py-3 text-navy/60">{t.ruc ?? '—'}</td>
                      <td className="px-4 py-3">
                        <select
                          className="rounded-md border border-navy/20 px-2 py-1 text-xs capitalize"
                          value={t.plan}
                          disabled={busyId === t.id}
                          onChange={(e) => cambiarPlan(t, e.target.value)}
                        >
                          {PLANES.includes(t.plan) ? null : <option value={t.plan}>{t.plan}</option>}
                          {PLANES.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        {t.activo ? (
                          <span className="text-emerald-600">Activo</span>
                        ) : (
                          <span className="text-red-500">Inactivo</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          disabled={busyId === t.id}
                          onClick={() => toggleActivo(t)}
                          className="text-xs font-medium text-navy/60 hover:text-navy disabled:opacity-40"
                        >
                          {t.activo ? 'Desactivar' : 'Reactivar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <Card>
          <CardTitle>Nuevo tenant</CardTitle>
          <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-3">
            <Input
              placeholder="Nombre de la empresa"
              required
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            />
            <Input
              placeholder="RUC (opcional)"
              value={form.ruc}
              onChange={(e) => setForm((f) => ({ ...f, ruc: e.target.value }))}
            />
            <select
              className="w-full rounded-md border border-navy/20 px-3 py-2 text-sm"
              value={form.plan}
              onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))}
            >
              {PLANES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={saving}>
              {saving ? 'Creando...' : 'Crear tenant'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
