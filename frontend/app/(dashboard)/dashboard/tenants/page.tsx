'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardTitle } from '@/components/ui/card';
import { Tenant } from '@/types';

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ nombre: '', ruc: '', plan: 'trial' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      await cargar();
    } catch {
      setError('No se pudo crear el tenant.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Empresas (tenants)</h1>
      <p className="mt-1 text-navy/60">Panel SaaS — exclusivo de super_admin.</p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="overflow-hidden rounded-lg border border-navy/10 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-navy/5 text-navy/70">
                <tr>
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">RUC</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-navy/50">
                      Cargando...
                    </td>
                  </tr>
                )}
                {tenants.map((t) => (
                  <tr key={t.id} className="border-t border-navy/5">
                    <td className="px-4 py-3">{t.nombre}</td>
                    <td className="px-4 py-3">{t.ruc ?? '—'}</td>
                    <td className="px-4 py-3 capitalize">{t.plan}</td>
                    <td className="px-4 py-3">
                      {t.activo ? (
                        <span className="text-emerald-600">Activo</span>
                      ) : (
                        <span className="text-red-500">Inactivo</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
              <option value="trial">trial</option>
              <option value="basico">básico</option>
              <option value="pro">pro</option>
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
