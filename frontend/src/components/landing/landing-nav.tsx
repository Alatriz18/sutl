'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, Radar, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '#problema', label: 'Problema' },
  { href: '#servicios', label: 'Servicios' },
  { href: '#plataforma', label: 'Plataforma' },
  { href: '#motor-de-riesgo', label: 'Motor de riesgo' },
  { href: '#industrias', label: 'Industrias' },
  { href: '#piloto', label: 'Piloto' },
];

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-300',
        scrolled || open ? 'border-b border-white/10 bg-navy/90 shadow-lg shadow-black/20 backdrop-blur-md' : 'bg-transparent',
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky to-sky/40 text-white shadow-lg shadow-sky/30">
            <Radar size={18} />
          </span>
          <span className="leading-none">
            <span className="block text-lg font-extrabold tracking-tight text-white">SUTL</span>
            <span className="block text-[9px] font-medium uppercase tracking-[0.18em] text-white/50">Control Tower</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-medium text-white/70 lg:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="transition-colors hover:text-white">
              {l.label}
            </a>
          ))}
          <Link href="/tracking" className="transition-colors hover:text-white">
            Rastrear
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden rounded-lg bg-white px-4 py-2 text-sm font-semibold text-navy transition-transform hover:-translate-y-0.5 sm:inline-flex"
          >
            Ingresar al panel
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={open}
            className="rounded-lg p-2 text-white hover:bg-white/10 lg:hidden"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-white/10 px-4 pb-5 pt-2 lg:hidden">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm font-medium text-white/80 hover:bg-white/5 hover:text-white"
            >
              {l.label}
            </a>
          ))}
          <Link href="/tracking" className="block rounded-lg px-3 py-2.5 text-sm font-medium text-white/80 hover:bg-white/5">
            Rastrear envío
          </Link>
          <Link
            href="/login"
            className="mt-2 block rounded-lg bg-white px-3 py-2.5 text-center text-sm font-semibold text-navy"
          >
            Ingresar al panel
          </Link>
        </nav>
      )}
    </header>
  );
}
