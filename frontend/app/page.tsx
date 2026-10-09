import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Bell,
  Boxes,
  FileText,
  Globe2,
  MapPinned,
  PlaneTakeoff,
  Search,
  ShieldCheck,
  Ship,
  Sparkles,
  Truck,
  Users,
  Zap,
} from 'lucide-react';

const CARRIERS = ['Maersk', 'MSC', 'CMA CGM', 'Hapag-Lloyd', 'Evergreen', 'IATA CargoWise'];

const FEATURES = [
  {
    icon: MapPinned,
    title: 'Tracking en tiempo real',
    description:
      'Cada envío con su línea de tiempo de eventos — ubicación, estado y responsable — visible para tu equipo y tu cliente final.',
  },
  {
    icon: Boxes,
    title: 'ERP logístico completo',
    description:
      'Cotizaciones, reservas, contenedores, almacén, flota y facturación en un solo sistema, sin hojas de cálculo sueltas.',
  },
  {
    icon: ShieldCheck,
    title: 'Multi-tenant seguro',
    description:
      'Cada empresa suscriptora opera aislada por diseño — tu información nunca se mezcla con la de otro tenant.',
  },
  {
    icon: Globe2,
    title: 'Portal público de seguimiento',
    description:
      'Tus clientes consultan el estado de su guía con un link público, sin crear cuenta ni instalar nada.',
  },
  {
    icon: Bell,
    title: 'Alertas inteligentes',
    description:
      'Reglas que avisan retrasos, documentos faltantes o llegadas próximas antes de que se conviertan en un problema.',
  },
  {
    icon: BarChart3,
    title: 'Reportes y analítica',
    description:
      'KPIs por estado, naviera y cliente, exportables en segundos para tus reuniones operativas.',
  },
];

const STEPS = [
  {
    step: '01',
    title: 'Registra tus envíos',
    description: 'Crea la guía con remitente, destinatario, naviera y modo de transporte en menos de un minuto.',
  },
  {
    step: '02',
    title: 'Actualiza el estado',
    description: 'Tu equipo registra cada evento — en tránsito, en aduana, entregado — desde cualquier dispositivo.',
  },
  {
    step: '03',
    title: 'Tu cliente ve todo',
    description: 'Comparte el link público de tracking y tu cliente sigue el envío sin llamarte a preguntar.',
  },
];

function MockDashboardCard() {
  const bars = [38, 62, 44, 90, 58, 72];
  return (
    <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/40 backdrop-blur">
      <div className="flex items-center gap-1.5 border-b border-white/10 bg-white/[0.03] px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-3 text-xs text-white/40">app.sutl.io/dashboard</span>
      </div>
      <div className="p-5">
        <div className="mb-4 grid grid-cols-4 gap-2">
          {[
            { label: 'Envíos', value: '248', color: 'text-white' },
            { label: 'Tránsito', value: '34', color: 'text-sky' },
            { label: 'Entregados', value: '201', color: 'text-emerald-400' },
            { label: 'Alertas', value: '3', color: 'text-gold' },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2">
              <p className="text-[10px] uppercase tracking-wide text-white/40">{s.label}</p>
              <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-white/70">Envíos por mes</p>
            <span className="text-[10px] text-emerald-400">+18%</span>
          </div>
          <div className="flex h-20 items-end gap-2">
            {bars.map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t bg-gradient-to-t from-sky to-sky/40"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-sky/15 p-1.5 text-sky">
              <Ship size={13} />
            </span>
            <div>
              <p className="text-xs font-medium text-white">SUTL-2026-0188</p>
              <p className="text-[10px] text-white/40">Guayaquil → Hamburgo</p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
            En tránsito
          </span>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="bg-white text-navy">
      {/* NAV */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-navy/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky/15 text-sky">
              <Ship size={17} />
            </span>
            <span className="text-lg font-bold text-white">SUTL</span>
          </div>
          <nav className="hidden items-center gap-8 text-sm font-medium text-white/70 sm:flex">
            <a href="#producto" className="transition-colors hover:text-white">
              Producto
            </a>
            <a href="#como-funciona" className="transition-colors hover:text-white">
              Cómo funciona
            </a>
            <Link href="/tracking" className="transition-colors hover:text-white">
              Rastrear envío
            </Link>
          </nav>
          <Link
            href="/login"
            className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-navy transition-opacity hover:opacity-90"
          >
            Ingresar al panel
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden bg-navy-radial text-white">
        <div className="pointer-events-none absolute inset-0 opacity-[0.07]" aria-hidden>
          <svg width="100%" height="100%">
            <pattern id="grid" width="36" height="36" patternUnits="userSpaceOnUse">
              <path d="M36 0H0V36" fill="none" stroke="white" strokeWidth="1" />
            </pattern>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 py-20 lg:grid-cols-2 lg:py-28">
          <div className="animate-fade-up">
            <span className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-medium text-gold">
              <Sparkles size={12} />
              Hecho para logística de Ecuador y LATAM
            </span>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              Visibilidad total de tus envíos,{' '}
              <span className="bg-gradient-to-r from-sky to-emerald-300 bg-clip-text text-transparent">
                de la bodega al cliente final
              </span>
            </h1>
            <p className="mt-5 max-w-lg text-lg text-sky-100/80">
              SUTL es la plataforma SaaS donde tu empresa de transporte o logística registra,
              rastrea y gestiona cada guía — y le da a tus clientes un link público para
              seguirla sin llamarte.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-sky px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky/20 transition-transform hover:-translate-y-0.5 hover:bg-sky/90"
              >
                Ver demo en vivo
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/tracking"
                className="inline-flex items-center justify-center gap-2 rounded-md border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                <Search size={16} />
                Rastrear un envío
              </Link>
            </div>
            <p className="mt-4 text-xs text-white/40">
              El demo en vivo carga con datos de muestra — no necesitas crear una cuenta.
            </p>
          </div>

          <div className="flex justify-center lg:justify-end">
            <MockDashboardCard />
          </div>
        </div>

        {/* trust strip */}
        <div className="relative border-t border-white/10 bg-black/10">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-6 sm:flex-row sm:justify-between">
            <p className="text-xs uppercase tracking-wide text-white/40">
              Integrable con las navieras y aerolíneas que ya usas
            </p>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
              {CARRIERS.map((c) => (
                <span key={c} className="text-sm font-medium text-white/60">
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="producto" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-wide text-sky">Producto</span>
          <h2 className="mt-2 text-3xl font-bold text-navy sm:text-4xl">
            Todo lo que necesita una operación logística, en un solo lugar
          </h2>
          <p className="mt-4 text-navy/60">
            Desde la cotización hasta la entrega — SUTL reemplaza las hojas de cálculo y los
            grupos de WhatsApp con un sistema pensado para tu operación diaria.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group rounded-xl border border-navy/10 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-navy/5"
            >
              <span className="inline-flex rounded-lg bg-navy/5 p-2.5 text-navy transition-colors group-hover:bg-sky group-hover:text-white">
                <f.icon size={20} />
              </span>
              <p className="mt-4 font-semibold text-navy">{f.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-navy/60">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="como-funciona" className="bg-slate-50 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-wide text-sky">Cómo funciona</span>
            <h2 className="mt-2 text-3xl font-bold text-navy sm:text-4xl">De la guía al cliente, en 3 pasos</h2>
          </div>

          <div className="relative mt-14 grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="absolute left-0 right-0 top-6 hidden h-px bg-navy/10 md:block" aria-hidden />
            {STEPS.map((s) => (
              <div key={s.step} className="relative flex flex-col items-start">
                <span className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">
                  {s.step}
                </span>
                <p className="mt-4 font-semibold text-navy">{s.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-navy/60">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ROLES / AUDIENCE */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {[
            { icon: Ship, label: 'Navieras y aerolíneas', desc: 'Catálogo centralizado de transportistas, tarifas y contratos vigentes.' },
            { icon: Truck, label: 'Transporte terrestre', desc: 'Flota, choferes y asignaciones conectadas a cada envío en ruta.' },
            { icon: Users, label: 'Clientes finales', desc: 'Visibilidad pública sin fricción — solo el código de su guía.' },
          ].map((r) => (
            <div key={r.label} className="rounded-xl bg-navy p-6 text-white">
              <r.icon size={22} className="text-gold" />
              <p className="mt-4 font-semibold">{r.label}</p>
              <p className="mt-1.5 text-sm text-white/60">{r.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA BAND */}
      <section className="bg-navy-radial py-20 text-white">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-6 text-center">
          <span className="inline-flex rounded-full bg-white/10 p-3 text-gold">
            <Zap size={22} />
          </span>
          <h2 className="text-3xl font-bold sm:text-4xl">Dale a tu operación la visibilidad que necesita</h2>
          <p className="max-w-xl text-sky-100/80">
            Prueba el panel completo ahora mismo con datos de muestra — sin registrarte, sin
            instalar nada.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-sky px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky/20 transition-transform hover:-translate-y-0.5 hover:bg-sky/90"
            >
              Ver demo en vivo
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/tracking"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Rastrear un envío
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-navy/10 bg-white py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-navy/50 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-navy/5 text-navy">
              <Ship size={13} />
            </span>
            <span>
              SUTL — un producto de <span className="font-medium text-navy/70">SVK Solutions</span>
            </span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/tracking" className="flex items-center gap-1.5 hover:text-navy">
              <PlaneTakeoff size={14} />
              Rastrear envío
            </Link>
            <Link href="/login" className="flex items-center gap-1.5 hover:text-navy">
              <FileText size={14} />
              Panel
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
