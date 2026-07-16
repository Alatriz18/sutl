'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardTitle } from '@/components/ui/card';
import { RolUsuario, User } from '@/types';

const ROLES: RolUsuario[] = ['admin_tenant', 'operador', 'cliente_final'];

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ email: '', password: '', nombre: '', rol: 'operador' as RolUsuario });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function cargar() {
    setLoading(true);
    const res = await api.get<User[]>('/users');
    setUsers(res.data);
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
      await api.post('/users', form);
      setForm({ email: '', password: '', nombre: '', rol: 'operador' });
      await cargar();
    } catch {
      setError('No se pudo crear el usuario. Verifica que el email no esté en uso.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Usuarios</h1>
      <p className="mt-1 text-navy/60">Usuarios de tu empresa dentro de SUTL.</p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="overflow-hidden rounded-lg border border-navy/10 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-navy/5 text-navy/70">
                <tr>
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Rol</th>
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
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-navy/5">
                    <td className="px-4 py-3">{u.nombre}</td>
                    <td className="px-4 py-3">{u.email}</td>
                    <td className="px-4 py-3 capitalize">{u.rol.replace('_', ' ')}</td>
                    <td className="px-4 py-3">
                      {u.activo ? (
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
          <CardTitle>Nuevo usuario</CardTitle>
          <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-3">
            <Input
              placeholder="Nombre"
              required
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            />
            <Input
              type="email"
              placeholder="Email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            <Input
              type="password"
              placeholder="Contraseña (mín. 8 caracteres)"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
            <select
              className="w-full rounded-md border border-navy/20 px-3 py-2 text-sm"
              value={form.rol}
              onChange={(e) => setForm((f) => ({ ...f, rol: e.target.value as RolUsuario }))}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={saving}>
              {saving ? 'Creando...' : 'Crear usuario'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
