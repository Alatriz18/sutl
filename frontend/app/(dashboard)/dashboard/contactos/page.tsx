'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardTitle } from '@/components/ui/card';
import { TableSkeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useToast } from '@/lib/toast-context';
import { extractApiError } from '@/lib/format';
import { Partner, TipoPartner } from '@/types';

const TIPOS: TipoPartner[] = ['cliente', 'agente', 'proveedor', 'transportista'];

const TIPO_LABEL: Record<TipoPartner, string> = {
  cliente: 'Cliente',
  agente: 'Agente',
  proveedor: 'Proveedor',
  transportista: 'Transportista',
};

const TIPO_COLOR: Record<TipoPartner, string> = {
  cliente: 'bg-sky/10 text-sky',
  agente: 'bg-violet-100 text-violet-700',
  proveedor: 'bg-amber-100 text-amber-700',
  transportista: 'bg-emerald-100 text-emerald-700',
};

export default function ContactosPage() {
  const toast = useToast();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [filtro, setFiltro] = useState<TipoPartner | 'todos'>('todos');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    tipo: 'cliente' as TipoPartner,
    nombre: '',
    taxId: '',
    email: '',
    telefono: '',
    contactoNombre: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    setLoading(true);
    const res = await api.get<Partner[]>('/partners');
    setPartners(res.data);
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
      await api.post('/partners', {
        ...form,
        taxId: form.taxId || undefined,
        email: form.email || undefined,
        telefono: form.telefono || undefined,
        contactoNombre: form.contactoNombre || undefined,
      });
      setForm({ tipo: form.tipo, nombre: '', taxId: '', email: '', telefono: '', contactoNombre: '' });
      toast.success('Contacto creado correctamente.');
      await cargar();
    } catch (err) {
      setError(extractApiError(err, 'No se pudo crear el contacto.'));
    } finally {
      setSaving(false);
    }
  }

  const visibles = filtro === 'todos' ? partners : partners.filter((p) => p.tipo === filtro);

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Clientes y proveedores</h1>
      <p className="mt-1 text-navy/60">CRM — directorio de clientes, agentes, proveedores y transportistas.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {(['todos', ...TIPOS] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFiltro(t)}
            className={cn(
              'rounded-full px-3 py-1 text-sm font-medium transition-colors',
              filtro === t ? 'bg-navy text-white' : 'bg-navy/5 text-navy/60 hover:bg-navy/10',
            )}
          >
            {t === 'todos' ? 'Todos' : TIPO_LABEL[t]}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="overflow-x-auto rounded-lg border border-navy/10 bg-white">
            {loading ? (
              <TableSkeleton rows={4} cols={4} />
            ) : (
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-navy/5 text-navy/70">
                <tr>
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Contacto</th>
                  <th className="px-4 py-3 font-medium">Email / Teléfono</th>
                </tr>
              </thead>
              <tbody>
                {visibles.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-navy/50">
                      Sin contactos en esta categoría.
                    </td>
                  </tr>
                )}
                {visibles.map((p) => (
                  <tr key={p.id} className="border-t border-navy/5">
                    <td className="px-4 py-3 font-medium text-navy">{p.nombre}</td>
                    <td className="px-4 py-3">
                      <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', TIPO_COLOR[p.tipo])}>
                        {TIPO_LABEL[p.tipo]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-navy/60">{p.contactoNombre ?? '—'}</td>
                    <td className="px-4 py-3 text-navy/60">
                      {p.email ?? '—'} {p.telefono && `· ${p.telefono}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>
        </div>

        <Card>
          <CardTitle>Nuevo contacto</CardTitle>
          <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-3">
            <select
              className="w-full rounded-md border border-navy/20 px-3 py-2 text-sm"
              value={form.tipo}
              onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as TipoPartner }))}
            >
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {TIPO_LABEL[t]}
                </option>
              ))}
            </select>
            <Input
              placeholder="Nombre / razón social"
              required
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            />
            <Input
              placeholder="RUC / Tax ID (opcional)"
              value={form.taxId}
              onChange={(e) => setForm((f) => ({ ...f, taxId: e.target.value }))}
            />
            <Input
              type="email"
              placeholder="Email (opcional)"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            <Input
              placeholder="Teléfono (opcional)"
              value={form.telefono}
              onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
            />
            <Input
              placeholder="Persona de contacto (opcional)"
              value={form.contactoNombre}
              onChange={(e) => setForm((f) => ({ ...f, contactoNombre: e.target.value }))}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={saving}>
              {saving ? 'Creando...' : 'Crear contacto'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
