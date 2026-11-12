'use client';

import { FormEvent, useId, useState } from 'react';
import { CheckCircle2, Send } from 'lucide-react';
import { api } from '@/lib/api';
import { extractApiError } from '@/lib/format';

const campo =
  'w-full rounded-lg border border-white/15 bg-white/10 px-3.5 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/40';

// Formulario público de contacto (diagnóstico). Guarda el contacto en el
// backend y avisa por correo al equipo comercial.
export function ContactForm() {
  const id = useId();
  const [form, setForm] = useState({ nombre: '', empresa: '', email: '', telefono: '', mensaje: '', sitioWeb: '' });
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await api.post('/leads', {
        nombre: form.nombre,
        empresa: form.empresa,
        email: form.email,
        ...(form.telefono.trim() ? { telefono: form.telefono } : {}),
        ...(form.mensaje.trim() ? { mensaje: form.mensaje } : {}),
        ...(form.sitioWeb ? { sitioWeb: form.sitioWeb } : {}),
      });
      setEnviado(true);
    } catch (err) {
      setError(extractApiError(err, 'No pudimos enviar tu solicitud. Inténtalo de nuevo en unos minutos.'));
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <div role="status" className="rounded-2xl border border-white/15 bg-white/10 p-8 text-center text-white">
        <CheckCircle2 className="mx-auto text-emerald-300" size={32} aria-hidden />
        <p className="mt-3 text-lg font-semibold">¡Gracias! Recibimos tu solicitud.</p>
        <p className="mt-1 text-sm text-white/70">Te escribiremos al correo que dejaste para coordinar el diagnóstico.</p>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="rounded-2xl border border-white/15 bg-white/5 p-6 text-left text-white sm:p-8" noValidate={false}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-nombre`} className="mb-1 block text-sm font-medium text-white/85">
            Tu nombre
          </label>
          <input id={`${id}-nombre`} className={campo} required minLength={2} maxLength={100} autoComplete="name" value={form.nombre} onChange={set('nombre')} />
        </div>
        <div>
          <label htmlFor={`${id}-empresa`} className="mb-1 block text-sm font-medium text-white/85">
            Empresa
          </label>
          <input id={`${id}-empresa`} className={campo} required minLength={2} maxLength={120} autoComplete="organization" value={form.empresa} onChange={set('empresa')} />
        </div>
        <div>
          <label htmlFor={`${id}-email`} className="mb-1 block text-sm font-medium text-white/85">
            Correo
          </label>
          <input id={`${id}-email`} type="email" className={campo} required maxLength={160} autoComplete="email" value={form.email} onChange={set('email')} />
        </div>
        <div>
          <label htmlFor={`${id}-telefono`} className="mb-1 block text-sm font-medium text-white/85">
            Teléfono <span className="text-white/45">(opcional)</span>
          </label>
          <input id={`${id}-telefono`} type="tel" className={campo} maxLength={25} autoComplete="tel" value={form.telefono} onChange={set('telefono')} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`${id}-mensaje`} className="mb-1 block text-sm font-medium text-white/85">
            ¿Qué quieres resolver? <span className="text-white/45">(opcional)</span>
          </label>
          <textarea id={`${id}-mensaje`} className={campo} rows={3} maxLength={1000} value={form.mensaje} onChange={set('mensaje')} />
        </div>
      </div>

      {/* Trampa para bots: las personas no lo ven ni lo llenan. */}
      <div className="absolute left-[-9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
        <label>
          No llenar este campo
          <input tabIndex={-1} autoComplete="off" value={form.sitioWeb} onChange={set('sitioWeb')} />
        </label>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-100">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-navy transition-transform hover:-translate-y-0.5 disabled:opacity-60 sm:w-auto"
      >
        <Send size={15} aria-hidden />
        {enviando ? 'Enviando...' : 'Agendar diagnóstico'}
      </button>
      <p className="mt-3 text-xs text-white/50">Usamos tus datos solo para contactarte por este diagnóstico. No los compartimos.</p>
    </form>
  );
}
