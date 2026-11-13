'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Ship, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardTitle } from '@/components/ui/card';
import { DEMO_MODE } from '@/lib/api';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Si la cuenta tiene segundo factor, el servidor pide el código tras validar la contraseña.
  const [pideCodigo, setPideCodigo] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const r = await login(email, password, pideCodigo ? codigo.trim() : undefined);
      if (r === 'mfa') setPideCodigo(true);
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      const mensaje = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      if (pideCodigo && status === 401) setError(mensaje ?? 'Código de verificación inválido.');
      else setError('Credenciales inválidas. Verifica tu email y contraseña.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-navy-radial px-4 py-10">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white"
        >
          <ArrowLeft size={14} />
          Volver al inicio
        </Link>
        <Card className="shadow-2xl shadow-black/30">
          <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-navy/5 text-navy">
            <Ship size={20} />
          </span>
          <CardTitle>Iniciar sesión</CardTitle>
          <p className="mb-6 mt-1 text-sm text-navy/60">Panel SUTL para empresas de logística</p>

          {(DEMO_MODE || process.env.NODE_ENV !== 'production') && (
            <button
              type="button"
              onClick={() => {
                // Sobreescribe el estado de React directamente — evita el
                // autocompletado del navegador, que puede sugerir una
                // contraseña vieja guardada de una sesión anterior.
                setEmail('admin@demo-transportes.com');
                setPassword('Demo2026!');
              }}
              className="mb-4 flex w-full items-start gap-2.5 rounded-md border border-gold/30 bg-gold/5 px-3 py-2.5 text-left text-xs text-navy/70 transition-colors hover:bg-gold/10"
            >
              <Sparkles size={14} className="mt-0.5 shrink-0 text-gold" />
              <span>
                <span className="font-medium text-navy">Credenciales demo:</span>{' '}
                <code className="font-mono text-navy">admin@demo-transportes.com</code> /{' '}
                <code className="font-mono text-navy">Demo2026!</code>
                <br />
                Toca aquí para autocompletar (evita el autofill del navegador).
              </span>
            </button>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="email-1" className="mb-1 block text-sm font-medium text-navy">Email</label>
              <Input id="email-1"
                type="email"
                required
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@demo-transportes.com"
              />
            </div>
            <div>
              <label htmlFor="contrasena-2" className="mb-1 block text-sm font-medium text-navy">Contraseña</label>
              <Input id="contrasena-2"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {pideCodigo && (
              <div>
                <label htmlFor="codigo-3" className="mb-1 block text-sm font-medium text-navy">Código de verificación</label>
                <Input id="codigo-3"
                  required
                  autoFocus
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={20}
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="123456"
                />
                <p className="mt-1 text-xs text-navy/60">Abre tu app de autenticación e ingresa el código de 6 dígitos, o uno de tus códigos de recuperación.</p>
              </div>
            )}

            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

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
      </div>
    </main>
  );
}
