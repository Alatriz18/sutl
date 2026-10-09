'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardTitle } from '@/components/ui/card';
import { DEMO_MODE } from '@/lib/api';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch {
      setError('Credenciales inválidas. Verifica tu email y contraseña.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-navy px-4">
      <Card className="w-full max-w-sm">
        <CardTitle>Iniciar sesión</CardTitle>
        <p className="mb-6 mt-1 text-sm text-navy/60">Panel SUTL para empresas de logística</p>

        {DEMO_MODE && (
          <button
            type="button"
            onClick={() => {
              setEmail('admin@demo-transportes.com');
              setPassword('Demo2026!');
            }}
            className="mb-4 w-full rounded-md border border-gold/30 bg-gold/5 px-3 py-2.5 text-left text-xs text-navy/70 transition-colors hover:bg-gold/10"
          >
            <span className="font-medium text-navy">Modo demo:</span> usa{' '}
            <code className="font-mono text-navy">admin@demo-transportes.com</code> /{' '}
            <code className="font-mono text-navy">Demo2026!</code>
            <br />
            Toca aquí para autocompletar.
          </button>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-navy">Email</label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@demo-transportes.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-navy">Contraseña</label>
            <Input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" disabled={loading} className="mt-2 w-full">
            {loading ? 'Ingresando...' : 'Ingresar'}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-navy/50">
          <Link href="/tracking" className="text-sky hover:underline">
            ¿Buscas el estado de un envío? Consulta el tracking público
          </Link>
        </p>
      </Card>
    </main>
  );
}
