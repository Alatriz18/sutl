'use client';

import { FormEvent, useCallback, useEffect, useId, useState } from 'react';
import { CheckCircle2, Copy, ShieldCheck } from 'lucide-react';
import { api, DEMO_MODE } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { extractApiError, formatDateTime } from '@/lib/format';
import { useToast } from '@/lib/toast-context';

interface EstadoMfa {
  activo: boolean;
  activadoEn: string | null;
  codigosDeRecuperacionRestantes: number;
}

interface Configuracion {
  secreto: string;
  otpauthUrl: string;
}

// Agrupa el secreto de a 4 para que sea fácil de teclear.
const agrupar = (s: string) => s.replace(/(.{4})/g, '$1 ').trim();

export default function SeguridadPage() {
  const id = useId();
  const toast = useToast();
  const [estado, setEstado] = useState<EstadoMfa | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<Configuracion | null>(null);
  const [codigo, setCodigo] = useState('');
  const [password, setPassword] = useState('');
  const [recuperacion, setRecuperacion] = useState<string[] | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(() => {
    if (DEMO_MODE) return;
    setError(null);
    api
      .get<EstadoMfa>('/auth/mfa')
      .then((r) => setEstado(r.data))
      .catch((err) => setError(extractApiError(err, 'No se pudo cargar el estado de la seguridad.')));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function ejecutar(accion: () => Promise<void>, falla: string) {
    setOcupado(true);
    try {
      await accion();
    } catch (err) {
      toast.error(extractApiError(err, falla));
    } finally {
      setOcupado(false);
    }
  }

  const iniciar = () =>
    ejecutar(async () => {
      const r = await api.post<Configuracion>('/auth/mfa/iniciar');
      setConfig(r.data);
      setCodigo('');
    }, 'No se pudo iniciar la configuración.');

  const activar = (e: FormEvent) => {
    e.preventDefault();
    return ejecutar(async () => {
      const r = await api.post<{ codigosDeRecuperacion: string[] }>('/auth/mfa/activar', { codigo: codigo.trim() });
      setRecuperacion(r.data.codigosDeRecuperacion);
      setConfig(null);
      setCodigo('');
      cargar();
    }, 'No se pudo activar el segundo factor.');
  };

  const desactivar = (e: FormEvent) => {
    e.preventDefault();
    return ejecutar(async () => {
      await api.post('/auth/mfa/desactivar', { password, codigo: codigo.trim() });
      toast.success('Segundo factor desactivado.');
      setPassword('');
      setCodigo('');
      cargar();
    }, 'No se pudo desactivar el segundo factor.');
  };

  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success('Copiado.');
    } catch {
      toast.error('No se pudo copiar: selecciónalo y cópialo a mano.');
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-navy">Seguridad de la cuenta</h1>
      <p className="mt-1 text-navy/60">
        El segundo factor pide, además de tu contraseña, un código que cambia cada 30 segundos en una app de autenticación (Google Authenticator, Microsoft Authenticator, Authy o 1Password). Así, aunque alguien conozca tu contraseña, no puede entrar.
      </p>

      {DEMO_MODE ? (
        <p className="mt-6 rounded-lg border border-sky/20 bg-sky/5 px-4 py-3 text-sm text-navy/70">
          El segundo factor funciona con la cuenta real y no está disponible en la demostración.
        </p>
      ) : error && !estado ? (
        <div className="mt-6 rounded-lg border border-navy/10 bg-white p-6 text-center">
          <p className="text-navy/70">{error}</p>
          <Button variant="ghost" className="mt-2" onClick={cargar}>Reintentar</Button>
        </div>
      ) : !estado ? (
        <Skeleton className="mt-6 h-48" />
      ) : recuperacion ? (
        <Card className="mt-6">
          <CardTitle>Guarda tus códigos de recuperación</CardTitle>
          <p className="mt-1 text-sm text-navy/70">
            Si pierdes tu teléfono, cada uno de estos códigos sirve <strong>una sola vez</strong> para entrar. No volverán a mostrarse: guárdalos en un lugar seguro (un gestor de contraseñas, por ejemplo).
          </p>
          <ul className="mt-4 grid grid-cols-2 gap-2 font-mono text-sm text-navy" aria-label="Códigos de recuperación">
            {recuperacion.map((c) => (
              <li key={c} className="rounded-md bg-navy/5 px-3 py-1.5">{c}</li>
            ))}
          </ul>
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" onClick={() => copiar(recuperacion.join('\n'))}>
              <Copy size={14} aria-hidden /> Copiar todos
            </Button>
            <Button onClick={() => setRecuperacion(null)}>Ya los guardé</Button>
          </div>
        </Card>
      ) : estado.activo ? (
        <Card className="mt-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 shrink-0 text-[#1A7A4C]" size={20} aria-hidden />
            <div>
              <CardTitle>Segundo factor activo</CardTitle>
              <p className="mt-1 text-sm text-navy/70">
                Activado el {formatDateTime(estado.activadoEn)}. Te quedan {estado.codigosDeRecuperacionRestantes} código(s) de recuperación sin usar.
              </p>
            </div>
          </div>
          <form onSubmit={desactivar} className="mt-5 border-t border-navy/10 pt-4">
            <h2 className="text-sm font-semibold text-navy">Desactivar el segundo factor</h2>
            <p className="mt-1 text-xs text-navy/60">Por seguridad, pide tu contraseña y un código de tu app (o de recuperación).</p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={`${id}-pw`} className="mb-1 block text-sm font-medium text-navy">Contraseña</label>
                <Input id={`${id}-pw`} type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div>
                <label htmlFor={`${id}-cd`} className="mb-1 block text-sm font-medium text-navy">Código</label>
                <Input id={`${id}-cd`} required inputMode="numeric" autoComplete="one-time-code" maxLength={20} value={codigo} onChange={(e) => setCodigo(e.target.value)} />
              </div>
            </div>
            <Button type="submit" variant="danger" className="mt-3" disabled={ocupado}>Desactivar</Button>
          </form>
        </Card>
      ) : config ? (
        <Card className="mt-6">
          <CardTitle>Configura tu app de autenticación</CardTitle>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-navy/80">
            <li>Abre tu app de autenticación y agrega una cuenta nueva con «ingresar clave de configuración».</li>
            <li>
              Escribe esta clave (no distingue mayúsculas):
              <span className="mt-1 flex items-center gap-2">
                <code className="rounded bg-navy/5 px-2 py-1 font-mono text-base tracking-wider text-navy">{agrupar(config.secreto)}</code>
                <button type="button" onClick={() => copiar(config.secreto)} aria-label="Copiar la clave" className="rounded p-1 text-navy/60 hover:bg-navy/5">
                  <Copy size={16} aria-hidden />
                </button>
              </span>
            </li>
            <li>Escribe aquí el código de 6 dígitos que muestra la app para confirmar.</li>
          </ol>
          <form onSubmit={activar} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="sm:w-48">
              <label htmlFor={`${id}-c`} className="mb-1 block text-sm font-medium text-navy">Código de 6 dígitos</label>
              <Input id={`${id}-c`} required inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="\d{6}" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
            </div>
            <Button type="submit" disabled={ocupado}>Activar</Button>
            <Button type="button" variant="ghost" onClick={() => setConfig(null)}>Cancelar</Button>
          </form>
        </Card>
      ) : (
        <Card className="mt-6">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 shrink-0 text-navy/50" size={20} aria-hidden />
            <div>
              <CardTitle>Segundo factor desactivado</CardTitle>
              <p className="mt-1 text-sm text-navy/70">Recomendado para administradores: protege el acceso a los datos de toda la empresa.</p>
            </div>
          </div>
          <Button className="mt-4" disabled={ocupado} onClick={iniciar}>Activar segundo factor</Button>
        </Card>
      )}
    </div>
  );
}
