import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Database,
  Download,
  Factory,
  FileText,
  FileWarning,
  Flame,
  History,
  KeyRound,
  Layers,
  ListChecks,
  Lock,
  Network,
  PackageSearch,
  PackageX,
  Pill,
  Puzzle,
  Quote,
  Radar,
  Search,
  ShieldCheck,
  Ship,
  Siren,
  Store,
  Truck,
  Users,
  Wheat,
  type LucideIcon,
} from 'lucide-react';
import { LandingNav } from '@/components/landing/landing-nav';
import { ControlTowerMock } from '@/components/landing/control-tower-mock';
import { CountUp, Reveal } from '@/components/landing/reveal';
import { OrchestrationHub } from '@/components/landing/orchestration-hub';
import { RiskSimulator } from '@/components/landing/risk-simulator';
import { ValueTabs } from '@/components/landing/value-tabs';
import { IcpCheck } from '@/components/landing/icp-check';

const SOURCES = [
  'ERP',
  'Excel / CSV',
  'Correo',
  'WhatsApp',
  'Portales de forwarders',
  'Documentos aduaneros',
  'Reportes de bodega',
  'APIs REST',
  'WMS / TMS',
  'Webhooks',
];

const STATS = [
  { value: 30925.2, decimals: 1, prefix: 'USD ', suffix: ' M', label: 'en importaciones de Ecuador en 2025 — récord, +11,5%' },
  { value: 17232, decimals: 0, prefix: 'USD ', suffix: ' M', label: 'importados solo en el 1er semestre de 2026 — +18%' },
  { value: 6.5, decimals: 1, prefix: '', suffix: '+', label: 'proveedores de transporte por empresa en promedio' },
  { value: 17.9, decimals: 1, prefix: 'USD ', suffix: '', label: 'de costo logístico por cada USD 100 vendidos' },
];

const PAINS: { icon: LucideIcon; dolor: string; consecuencia: string; respuesta: string }[] = [
  {
    icon: Puzzle,
    dolor: 'Información fragmentada',
    consecuencia: 'Baja visibilidad y seguimiento duplicado.',
    respuesta: 'Expediente digital único por operación, OC y SKU.',
  },
  {
    icon: Users,
    dolor: 'Múltiples operadores',
    consecuencia: 'Responsabilidad difusa y seguimiento manual.',
    respuesta: 'Orquestación neutral y matriz de responsables.',
  },
  {
    icon: PackageX,
    dolor: 'Inventario desconectado del tránsito',
    consecuencia: 'Quiebres de stock o sobreinventario.',
    respuesta: 'Cobertura, ETA, consumo y OC en una sola vista.',
  },
  {
    icon: Flame,
    dolor: 'Gestión reactiva',
    consecuencia: 'Urgencias, fletes premium y compras de emergencia.',
    respuesta: 'Motor de excepciones y alertas anticipadas.',
  },
  {
    icon: FileWarning,
    dolor: 'Documentos dispersos',
    consecuencia: 'Demoras, reprocesos y riesgo de incumplimiento.',
    respuesta: 'Repositorio, checklist y control de vencimientos.',
  },
  {
    icon: Layers,
    dolor: 'Software sin adopción',
    consecuencia: 'Se compra un SaaS y se sigue operando igual.',
    respuesta: 'Servicio gestionado que usa la plataforma a diario.',
  },
];

const OFFERS = [
  {
    name: 'SUTL Platform',
    tagline: 'El software',
    includes: ['Dashboards y control tower', 'Documentos y expediente digital', 'Alertas por reglas', 'Integraciones y trazabilidad'],
    ideal: 'Empresas con un equipo interno robusto que quiere operar la herramienta.',
    highlight: false,
  },
  {
    name: 'Managed Control Tower',
    tagline: 'Software + analista SUTL',
    includes: [
      'Todo lo de Platform',
      'Analista SUTL dedicado a tu operación',
      'Seguimiento activo de proveedores y operadores',
      'Gestión de excepciones de punta a punta',
    ],
    ideal: 'Operaciones complejas con capacidad interna limitada.',
    highlight: true,
  },
  {
    name: 'Supply Control',
    tagline: 'Continuidad del abastecimiento',
    includes: [
      'Todo lo de Managed Control Tower',
      'Cobertura de inventario y riesgo de stock',
      'Priorización de compras',
      'Gestión del abastecimiento',
    ],
    ideal: 'Manufactura, alimentos, farmacéutica, importadores y distribuidores.',
    highlight: false,
  },
];

const PRICING_PARTS = [
  { title: 'Onboarding', desc: 'Mapeo de flujos, carga de datos, configuración, integraciones y playbook. Pago único.' },
  { title: 'Plataforma', desc: 'Acceso, módulos, dashboards, almacenamiento e integraciones estándar. Mensual.' },
  { title: 'Servicio gestionado', desc: 'Capacidad de analista y gestión de excepciones. Mensual.' },
  { title: 'Complejidad', desc: 'Escalones por volumen de OCs, embarques, SKU, plantas o SLA.' },
];

const MODULES: { icon: LucideIcon; name: string; mvp: string; next: string }[] = [
  { icon: ClipboardList, name: 'Control de OCs', mvp: 'Carga por API o archivo, líneas, cantidades, fechas, proveedor, estado y responsable.', next: 'Confirmación colaborativa y score de proveedor.' },
  { icon: Boxes, name: 'Inventario & cobertura', mvp: 'Stock, consumo, días de cobertura, safety stock y demanda básica.', next: 'Forecast, escenarios y recomendaciones.' },
  { icon: Ship, name: 'Shipment tracking', mvp: 'Hitos, ETD/ETA, puertos, BL/AWB, contenedor y transportista.', next: 'Integración con carriers y predicción de ETA.' },
  { icon: Truck, name: 'Movimientos nacionales', mvp: 'Despacho, tránsito, recepción y prueba de entrega (POD).', next: 'Integración con GPS/TMS de terceros.' },
  { icon: FileText, name: 'Documentos', mvp: 'OC, factura, packing list, certificados, BL/AWB y permisos.', next: 'Extracción y validación con OCR/IA.' },
  { icon: Siren, name: 'Motor de excepciones', mvp: 'Reglas, severidad, SLA, responsable y escalamiento.', next: 'Detección predictiva por patrón.' },
  { icon: Radar, name: 'Control Tower', mvp: 'Vista de operaciones, mapa lógico, riesgos y tareas.', next: 'Cockpit por planta, proveedor y categoría.' },
  { icon: ListChecks, name: 'Workflow humano', mvp: 'Tareas, comentarios, evidencia, responsables y bitácora.', next: 'Playbooks automáticos y aprobaciones.' },
  { icon: BarChart3, name: 'Analytics', mvp: 'OTIF, lead time, aging, stockouts y cumplimiento de proveedor.', next: 'Benchmarking y cost-to-serve.' },
  { icon: Network, name: 'Portal colaborativo', mvp: 'Acceso por rol para cliente, proveedor y operador.', next: 'Confirmaciones y autoservicio.' },
];

const CADENCE = [
  { when: 'Continuo', what: 'Captura de hitos, actualización de ETA, ingesta de inventario y detección de excepciones.' },
  { when: 'Diario', what: 'Revisión de riesgos críticos, OCs atrasadas, embarques sin hito, documentos faltantes y stock crítico.' },
  { when: 'Semanal', what: 'Reunión de excepciones: aging, proveedores incumplidos, cobertura y prioridades.' },
  { when: 'Mensual', what: 'SLA y KPI, causas raíz, ahorro y costos evitados, calidad de datos y plan de mejora.' },
  { when: 'Trimestral', what: 'Business review: tendencias, nuevas automatizaciones, alcance y capacidad.' },
];

const RACI: { proceso: string; cliente: string; sutl: string; operador: string }[] = [
  { proceso: 'Aprobar compra', cliente: 'A/R', sutl: 'I', operador: 'I' },
  { proceso: 'Monitorear OC', cliente: 'C', sutl: 'A/R', operador: 'C' },
  { proceso: 'Confirmar fecha', cliente: 'I', sutl: 'C', operador: 'A/R' },
  { proceso: 'Ejecutar transporte', cliente: 'I', sutl: 'C', operador: 'A/R' },
  { proceso: 'Detectar riesgo', cliente: 'C', sutl: 'A/R', operador: 'I' },
  { proceso: 'Decidir expedite o cambio', cliente: 'A/R', sutl: 'C', operador: 'C' },
  { proceso: 'Mantener evidencia', cliente: 'C', sutl: 'A/R', operador: 'C' },
];

const INDUSTRIES: { icon: LucideIcon; name: string; why: string; priority: string; level: number }[] = [
  { icon: Wheat, name: 'Agroindustria y alimentos', why: 'Muchos insumos y empaques, exportación, estacionalidad y alto costo de interrupción.', priority: 'Muy alta', level: 4 },
  { icon: Pill, name: 'Farmacéutica y dispositivos', why: 'Trazabilidad, documentación, condiciones regulatorias y continuidad de abastecimiento.', priority: 'Muy alta', level: 4 },
  { icon: Factory, name: 'Manufactura', why: 'Materias primas, repuestos, múltiples proveedores y dependencia directa de la producción.', priority: 'Alta', level: 3 },
  { icon: PackageSearch, name: 'Importadores y distribuidores', why: 'Gran número de OCs y embarques, necesidad constante de ETA y stock.', priority: 'Alta', level: 3 },
  { icon: Store, name: 'Retail especializado', why: 'Reposición continua con múltiples SKU y proveedores.', priority: 'Media', level: 2 },
];

const COMPETITION = [
  { cat: 'Excel + correo + WhatsApp', fuerza: 'Flexible y conocido por todos.', vacio: 'Fragmentación, cero trazabilidad y dependencia de personas.' },
  { cat: 'ERP / módulo de compras', fuerza: 'Datos transaccionales y financieros.', vacio: 'No orquesta a terceros ni gestiona excepciones de punta a punta.' },
  { cat: 'TMS / tracking', fuerza: 'Visibilidad del transporte.', vacio: 'No conecta inventario, compras y riesgo de abastecimiento.' },
  { cat: 'Forwarders / 3PL', fuerza: 'Capacidad de ejecución física.', vacio: 'Enfocados en su propia operación y su propia red.' },
  { cat: '4PL global', fuerza: 'Orquestación sofisticada.', vacio: 'Sobredimensionado para buena parte del mercado ecuatoriano.' },
];

const PILOT = [
  { phase: 'Diagnóstico', start: 1, end: 2, out: 'Mapa de flujo, fuentes de datos, baseline y KPI.' },
  { phase: 'Configuración', start: 2, end: 3, out: 'Carga de maestros, OCs, inventario, reglas y responsables.' },
  { phase: 'Operación controlada', start: 4, end: 8, out: 'Control tower diario y gestión de excepciones.' },
  { phase: 'Evaluación', start: 9, end: 10, out: 'Resultados, ROI, brechas y propuesta anual.' },
  { phase: 'Conversión', start: 10, end: 12, out: 'Contrato, SLA, alcance e integraciones.' },
];

const BASELINE = ['Horas de seguimiento', 'OCs atrasadas', 'Urgencias y expedites', 'Quiebres de stock', 'Confiabilidad de fechas'];

const ROADMAP = [
  { when: '0–3 meses', title: 'MVP operable', items: 'OCs, proveedores, embarques, documentos, inventario básico, dashboard, tareas y alertas por reglas.' },
  { when: '3–6 meses', title: 'Control Tower gestionada', items: 'Centro de excepciones, SLA, bitácora, reportes KPI, portal colaborativo y plantillas de onboarding.' },
  { when: '6–12 meses', title: 'Supply Control', items: 'Cobertura, riesgo de stockout, consumo, variabilidad de lead time y score de proveedor.' },
  { when: '12–18 meses', title: 'Automatización', items: 'Ingesta automática de hitos, extracción documental, recomendaciones y playbooks automáticos.' },
  { when: '18–24 meses', title: 'Escala', items: 'Benchmarking, multi-país, capacidades predictivas y marketplace de conectores.' },
];

const SECURITY: { icon: LucideIcon; title: string; desc: string }[] = [
  { icon: Lock, title: 'Aislamiento multi-tenant', desc: 'Cada cliente opera en su propio espacio: ningún dato cruza entre empresas.' },
  { icon: KeyRound, title: 'Roles por actor', desc: 'Permisos granulares para cliente, analista SUTL, proveedor y operador.' },
  { icon: History, title: 'Bitácora completa', desc: 'Cada cambio registra quién, qué, cuándo y la fuente del dato.' },
  { icon: ShieldCheck, title: 'Cifrado de punta a punta', desc: 'TLS en tránsito y cifrado en reposo para la información sensible.' },
  { icon: Download, title: 'Tus datos son tuyos', desc: 'Exportación completa de datos y evidencia de auditoría en cualquier momento.' },
  { icon: Database, title: 'Continuidad', desc: 'Backups, retención y plan de continuidad para operación empresarial.' },
];

function SectionHeader({
  eyebrow,
  title,
  subtitle,
  dark = false,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: string;
  dark?: boolean;
}) {
  return (
    <Reveal className="mx-auto max-w-3xl text-center">
      <span className="text-sm font-semibold uppercase tracking-[0.16em] text-sky">{eyebrow}</span>
      <h2 className={`mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl ${dark ? 'text-white' : 'text-navy'}`}>{title}</h2>
      {subtitle && <p className={`mx-auto mt-5 max-w-2xl text-lg ${dark ? 'text-white/60' : 'text-navy/60'}`}>{subtitle}</p>}
    </Reveal>
  );
}

function GridPattern({ id }: { id: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 opacity-[0.06]" aria-hidden>
      <svg width="100%" height="100%">
        <pattern id={id} width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" stroke="white" strokeWidth="1" />
        </pattern>
        <rect width="100%" height="100%" fill={`url(#${id})`} />
      </svg>
    </div>
  );
}

const RACI_TONE: Record<string, string> = {
  'A/R': 'bg-navy text-white',
  C: 'bg-sky/15 text-navy',
  I: 'bg-slate-100 text-navy/50',
};

export default function HomePage() {
  return (
    <main className="overflow-x-hidden bg-white text-navy">
      <LandingNav />

      {/* HERO */}
      <section className="relative overflow-hidden bg-navy-radial text-white">
        <GridPattern id="hero-grid" />
        <div className="pointer-events-none absolute -left-40 top-20 h-96 w-96 rounded-full bg-sky/20 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-gold/10 blur-3xl" aria-hidden />

        <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 px-4 pb-20 pt-32 sm:px-6 lg:grid-cols-2 lg:pb-28 lg:pt-40">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-gold">
              <Radar size={13} />
              Managed Supply Chain Control Tower
            </span>
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              SUTL no mueve la carga.{' '}
              <span className="bg-gradient-to-r from-sky via-cyan-300 to-emerald-300 bg-clip-text text-transparent">
                Orquesta a quienes la mueven.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/70">
              Plataforma tecnológica + analistas expertos que unen compras, inventario y logística en una sola
              torre de control — y que, cuando algo se desvía, se aseguran de que alguien actúe.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="group inline-flex items-center justify-center gap-2 rounded-lg bg-sky px-6 py-3.5 text-sm font-semibold text-white shadow-xl shadow-sky/25 transition-all hover:-translate-y-0.5 hover:bg-sky/90"
              >
                Ver la plataforma en vivo
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a
                href="#piloto"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Conoce el piloto de 12 semanas
              </a>
            </div>
            <ul className="mt-10 grid grid-cols-1 gap-3 text-sm text-white/65 sm:grid-cols-3">
              {['Software + analista dedicado', 'Neutral frente a operadores', 'Resultados medibles en un piloto'].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex justify-center motion-safe:animate-float lg:justify-end">
            <ControlTowerMock />
          </div>
        </div>

        <div className="relative border-t border-white/10 bg-black/15 py-5">
          <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">
            Una sola verdad a partir de las fuentes que ya usas
          </p>
          <div className="relative flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
            <div className="flex shrink-0 gap-10 pr-10 motion-safe:animate-marquee">
              {[...SOURCES, ...SOURCES].map((s, i) => (
                <span key={`${s}-${i}`} className="whitespace-nowrap text-sm font-medium text-white/55">
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* MERCADO */}
      <section className="border-b border-navy/5 bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl bg-navy/10 sm:grid-cols-2 lg:grid-cols-4">
            {STATS.map((s, i) => (
              <Reveal key={s.label} delay={i * 90} className="bg-white p-7">
                <p className="text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
                  <CountUp value={s.value} decimals={s.decimals} prefix={s.prefix} suffix={s.suffix} />
                </p>
                <p className="mt-2 text-sm leading-relaxed text-navy/55">{s.label}</p>
              </Reveal>
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-navy/40">
            Fuentes: Banco Central del Ecuador (2025 y 1S 2026) · Encuesta Nacional Logística del Ecuador 2023.
          </p>
        </div>
      </section>

      {/* PROBLEMA */}
      <section id="problema" className="scroll-mt-[72px] bg-slate-50 py-24 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeader
            eyebrow="El problema"
            title={
              <>
                Saber dónde está el contenedor <span className="text-sky">ya no alcanza</span>
              </>
            }
            subtitle="Hay que relacionar cada embarque con la orden de compra, el inventario, el proveedor, el documento pendiente y el impacto real en tu operación. Hoy eso vive repartido entre ERP, hojas de cálculo, correos y WhatsApp."
          />
          <div className="mt-16 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {PAINS.map((p, i) => (
              <Reveal key={p.dolor} delay={(i % 3) * 90}>
                <div className="group flex h-full flex-col rounded-2xl border border-navy/10 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-navy/5">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-500 transition-colors group-hover:bg-navy group-hover:text-white">
                    <p.icon size={20} />
                  </span>
                  <p className="mt-5 text-lg font-bold text-navy">{p.dolor}</p>
                  <p className="mt-1 text-sm text-navy/55">{p.consecuencia}</p>
                  <div className="mt-auto pt-5">
                    <div className="flex items-start gap-2 rounded-xl bg-sky/5 px-4 py-3 text-sm font-medium text-navy">
                      <ArrowRight size={15} className="mt-0.5 shrink-0 text-sky" />
                      {p.respuesta}
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ORQUESTACION */}
      <section className="py-24 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeader
            eyebrow="Cómo trabajamos"
            title="Una capa neutral entre todos los que mueven tu carga"
            subtitle="Cada actor mantiene su responsabilidad. SUTL se encarga de que la información fluya, de que los compromisos se cumplan y de que cada desvío tenga un responsable. Toca cada actor para ver el reparto."
          />
          <div className="mt-16">
            <OrchestrationHub />
          </div>
        </div>
      </section>

      {/* SERVICIOS */}
      <section id="servicios" className="relative scroll-mt-[72px] overflow-hidden bg-navy-radial py-24 text-white sm:py-28">
        <GridPattern id="services-grid" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeader
            dark
            eyebrow="Servicios"
            title="Compra un resultado operativo, no otra herramienta"
            subtitle="Tres niveles que crecen contigo: desde el software hasta la continuidad completa de tu abastecimiento."
          />
          <div className="mt-16 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {OFFERS.map((o, i) => (
              <Reveal key={o.name} delay={i * 110}>
                <div
                  className={`relative flex h-full flex-col rounded-2xl p-7 sm:p-8 ${
                    o.highlight
                      ? 'bg-white text-navy shadow-2xl shadow-sky/20 ring-2 ring-sky lg:-translate-y-4'
                      : 'border border-white/10 bg-white/[0.04] backdrop-blur'
                  }`}
                >
                  {o.highlight && (
                    <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-sky px-4 py-1 text-xs font-semibold text-white shadow-lg">
                      Corazón del modelo SUTL
                    </span>
                  )}
                  <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${o.highlight ? 'text-sky' : 'text-gold'}`}>
                    {o.tagline}
                  </p>
                  <p className="mt-2 text-2xl font-extrabold">{o.name}</p>
                  <ul className="mt-6 space-y-3">
                    {o.includes.map((inc) => (
                      <li key={inc} className="flex items-start gap-2.5 text-sm">
                        <CheckCircle2 size={17} className={`mt-0.5 shrink-0 ${o.highlight ? 'text-sky' : 'text-emerald-400'}`} />
                        <span className={o.highlight ? 'text-navy/80' : 'text-white/75'}>{inc}</span>
                      </li>
                    ))}
                  </ul>
                  <div className={`mt-auto pt-8 text-sm ${o.highlight ? 'text-navy/60' : 'text-white/50'}`}>
                    <p className={`mb-1 text-xs font-semibold uppercase tracking-wide ${o.highlight ? 'text-navy/40' : 'text-white/35'}`}>
                      Ideal para
                    </p>
                    {o.ideal}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-16 rounded-2xl border border-white/10 bg-black/15 p-6 sm:p-8">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">Modelo de precio</p>
                <p className="mt-1 text-xl font-bold">Cobramos por operación controlada, no por usuario</p>
              </div>
              <p className="text-sm text-white/50">Propuesta a medida tras el diagnóstico.</p>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PRICING_PARTS.map((p, i) => (
                <div key={p.title} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs font-bold text-sky">0{i + 1}</p>
                  <p className="mt-1 font-semibold">{p.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-white/55">{p.desc}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* PLATAFORMA */}
      <section id="plataforma" className="scroll-mt-[72px] py-24 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeader
            eyebrow="La plataforma"
            title="Diez módulos, un solo expediente por operación"
            subtitle="Desde la orden de compra hasta la recepción en bodega, cada dato conectado con su proveedor, su embarque, su documento y su riesgo."
          />
          <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {MODULES.map((m, i) => (
              <Reveal key={m.name} delay={(i % 5) * 70}>
                <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-navy/10 bg-white p-5 transition-all hover:-translate-y-1 hover:border-sky/40 hover:shadow-xl hover:shadow-navy/5">
                  <span className="absolute right-4 top-4 text-xs font-bold text-navy/15">{String(i + 1).padStart(2, '0')}</span>
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-navy text-white transition-colors group-hover:bg-sky">
                    <m.icon size={19} />
                  </span>
                  <p className="mt-4 font-bold text-navy">{m.name}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-navy/60">{m.mvp}</p>
                  <p className="mt-auto pt-4 text-xs text-navy/45">
                    <span className="font-semibold text-gold">Próximo: </span>
                    {m.next}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* MOTOR DE RIESGO */}
      <section id="motor-de-riesgo" className="relative scroll-mt-[72px] overflow-hidden bg-[#071428] py-24 text-white sm:py-28">
        <GridPattern id="risk-grid" />
        <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-sky/15 blur-3xl" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeader
            dark
            eyebrow="Nuestro diferencial"
            title="El motor de riesgo de abastecimiento"
            subtitle="Conectamos lo que tienes en bodega con lo que viene en camino. Así sabemos, días antes, qué material va a faltar y qué hacer al respecto."
          />
          <Reveal className="mx-auto mt-10 max-w-3xl rounded-2xl border border-sky/20 bg-sky/5 px-6 py-5 text-center font-mono text-sm leading-relaxed text-sky-100/85 sm:text-base">
            Riesgo SKU = f(cobertura disponible, consumo esperado, cantidad abierta, ETA ajustada, variabilidad del lead
            time, criticidad del material, confiabilidad del proveedor)
          </Reveal>
          <Reveal className="mt-10">
            <RiskSimulator />
          </Reveal>
        </div>
      </section>

      {/* PROPUESTA DE VALOR */}
      <section className="bg-slate-50 py-24 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeader
            eyebrow="Valor por área"
            title="Cada área gana algo que puede medir"
            subtitle="No prometemos ahorros genéricos: acordamos los KPI de cada área en el diagnóstico y los medimos contra el baseline."
          />
          <Reveal className="mt-14">
            <ValueTabs />
          </Reveal>
        </div>
      </section>

      {/* MODELO OPERATIVO */}
      <section className="py-24 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeader
            eyebrow="Modelo operativo"
            title="Un playbook explícito para cada cliente"
            subtitle="El analista SUTL no reemplaza las autorizaciones de tu equipo: controla el flujo y gestiona las excepciones con una cadencia fija."
          />
          <div className="mt-16 grid grid-cols-1 gap-12 lg:grid-cols-2">
            <Reveal>
              <ol className="relative space-y-6 border-l-2 border-navy/10 pl-8">
                {CADENCE.map((c) => (
                  <li key={c.when} className="relative">
                    <span className="absolute -left-[2.6rem] top-0.5 flex h-5 w-5 items-center justify-center rounded-full border-4 border-white bg-sky shadow" />
                    <p className="text-sm font-bold uppercase tracking-wide text-sky">{c.when}</p>
                    <p className="mt-1 text-navy/70">{c.what}</p>
                  </li>
                ))}
              </ol>
            </Reveal>
            <Reveal delay={120}>
              <div className="overflow-hidden rounded-2xl border border-navy/10 shadow-sm">
                <div className="bg-navy px-5 py-4 text-white">
                  <p className="font-bold">Matriz de responsabilidades (RACI)</p>
                  <p className="text-xs text-white/55">A = aprueba · R = ejecuta · C = consultado · I = informado</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead>
                      <tr className="border-b border-navy/10 bg-slate-50 text-left text-xs uppercase tracking-wide text-navy/50">
                        <th className="px-5 py-3 font-semibold">Proceso</th>
                        <th className="px-3 py-3 text-center font-semibold">Cliente</th>
                        <th className="px-3 py-3 text-center font-semibold text-sky">SUTL</th>
                        <th className="px-3 py-3 text-center font-semibold">Operador</th>
                      </tr>
                    </thead>
                    <tbody>
                      {RACI.map((r) => (
                        <tr key={r.proceso} className="border-b border-navy/5 last:border-0">
                          <td className="px-5 py-3 font-medium text-navy">{r.proceso}</td>
                          {[r.cliente, r.sutl, r.operador].map((v, i) => (
                            <td key={i} className="px-3 py-3 text-center">
                              <span className={`inline-block min-w-[2.6rem] rounded-md px-2 py-0.5 text-xs font-bold ${RACI_TONE[v]}`}>{v}</span>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* INDUSTRIAS */}
      <section id="industrias" className="scroll-mt-[72px] bg-slate-50 py-24 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeader
            eyebrow="Industrias"
            title="Donde una interrupción cuesta caro"
            subtitle="Empezamos por los sectores con más proveedores, más SKU críticos y mayor costo de un quiebre de stock."
          />
          <div className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {INDUSTRIES.map((ind, i) => (
              <Reveal key={ind.name} delay={i * 80}>
                <div className="flex h-full flex-col rounded-2xl border border-navy/10 bg-white p-6 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-navy/5">
                  <ind.icon size={26} className="text-sky" />
                  <p className="mt-4 font-bold text-navy">{ind.name}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-navy/60">{ind.why}</p>
                  <div className="mt-auto pt-5">
                    <div className="flex gap-1" aria-hidden>
                      {[1, 2, 3, 4].map((n) => (
                        <span key={n} className={`h-1.5 flex-1 rounded-full ${n <= ind.level ? 'bg-sky' : 'bg-navy/10'}`} />
                      ))}
                    </div>
                    <p className="mt-2 text-xs font-semibold text-navy/50">Encaje: {ind.priority}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <p className="mx-auto mt-8 max-w-3xl text-center text-xs leading-relaxed text-navy/45">
            En farmacéutica, SUTL actúa como capa de software y orquestación — no almacena, distribuye ni transporta
            producto. El alcance de cada servicio gestionado se define respetando la normativa ARCSA de buenas prácticas.
          </p>
        </div>
      </section>

      {/* COMPETENCIA */}
      <section className="py-24 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeader
            eyebrow="Por qué SUTL"
            title="El hueco que nadie está cubriendo"
            subtitle="Cada alternativa resuelve una parte. Ninguna une abastecimiento, inventario y logística con alguien responsable de actuar."
          />
          <Reveal className="mt-14 overflow-hidden rounded-2xl border border-navy/10 shadow-sm">
            <div className="divide-y divide-navy/5">
              {COMPETITION.map((c) => (
                <div key={c.cat} className="grid grid-cols-1 gap-2 px-6 py-5 sm:grid-cols-3 sm:gap-6">
                  <p className="font-bold text-navy">{c.cat}</p>
                  <p className="text-sm text-navy/60">
                    <span className="font-semibold text-emerald-600">+ </span>
                    {c.fuerza}
                  </p>
                  <p className="text-sm text-navy/60">
                    <span className="font-semibold text-red-500">− </span>
                    {c.vacio}
                  </p>
                </div>
              ))}
              <div className="grid grid-cols-1 gap-2 bg-navy px-6 py-6 text-white sm:grid-cols-3 sm:gap-6">
                <p className="flex items-center gap-2 font-extrabold">
                  <Radar size={18} className="text-sky" />
                  SUTL
                </p>
                <p className="text-sm text-white/80">Neutral frente a operadores + software + analista dedicado.</p>
                <p className="text-sm text-white/80">Une OC, inventario, logística y documentos — y asegura que alguien actúe.</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* PILOTO */}
      <section id="piloto" className="scroll-mt-[72px] bg-slate-50 py-24 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeader
            eyebrow="Piloto"
            title="12 semanas para probarlo con tus propios datos"
            subtitle="Medimos un baseline antes de empezar y comparamos al final: la decisión de continuar se toma con resultados en la mano."
          />
          <Reveal className="mt-14 overflow-hidden rounded-2xl border border-navy/10 bg-white p-5 shadow-sm sm:p-8">
            <div className="overflow-x-auto">
              <div className="min-w-[640px]">
                <div className="mb-3 grid grid-cols-[240px_repeat(12,1fr)] gap-1 text-center text-[11px] font-semibold text-navy/40">
                  <span />
                  {Array.from({ length: 12 }, (_, i) => (
                    <span key={i}>S{i + 1}</span>
                  ))}
                </div>
                <div className="space-y-3">
                  {PILOT.map((p) => (
                    <div key={p.phase} className="grid grid-cols-[240px_repeat(12,1fr)] items-center gap-1">
                      <div className="pr-4">
                        <p className="text-sm font-semibold text-navy">{p.phase}</p>
                        <p className="text-xs leading-snug text-navy/50">{p.out}</p>
                      </div>
                      <div
                        className="flex h-9 items-center justify-center rounded-lg bg-gradient-to-r from-navy to-sky text-xs font-semibold text-white shadow-sm"
                        style={{ gridColumn: `${p.start + 1} / ${p.end + 2}` }}
                      >
                        S{p.start}–{p.end}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
          <Reveal className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <p className="text-sm font-semibold text-navy/60">Baseline que medimos:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {BASELINE.map((b) => (
                <span key={b} className="rounded-full border border-navy/10 bg-white px-3.5 py-1.5 text-sm text-navy/75">
                  {b}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ROADMAP */}
      <section className="py-24 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeader
            eyebrow="Hoja de ruta"
            title="De servicio tecnológico a plataforma de alto margen"
            subtitle="Cada tarea que un analista repite se convierte en candidata a automatización. Así crecemos sin perder el SLA."
          />
          <div className="relative mt-16">
            <div className="absolute left-0 right-0 top-5 hidden h-0.5 bg-gradient-to-r from-sky via-navy/30 to-gold lg:block" aria-hidden />
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
              {ROADMAP.map((r, i) => (
                <Reveal key={r.when} delay={i * 90}>
                  <div className="relative">
                    <span className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-navy text-sm font-bold text-white ring-4 ring-white">
                      {i + 1}
                    </span>
                    <p className="mt-4 text-xs font-bold uppercase tracking-wide text-sky">{r.when}</p>
                    <p className="mt-1 text-lg font-bold text-navy">{r.title}</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-navy/60">{r.items}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SEGURIDAD */}
      <section className="bg-slate-50 py-24 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeader
            eyebrow="Seguridad"
            title="Seguridad desde el diseño"
            subtitle="Tu información de compras, proveedores e inventario es estratégica. La tratamos así."
          />
          <div className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SECURITY.map((s, i) => (
              <Reveal key={s.title} delay={(i % 3) * 80}>
                <div className="flex h-full gap-4 rounded-2xl border border-navy/10 bg-white p-6">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <s.icon size={20} />
                  </span>
                  <div>
                    <p className="font-bold text-navy">{s.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-navy/60">{s.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* TESIS */}
      <section className="py-24 sm:py-28">
        <Reveal className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <Quote size={40} className="mx-auto text-gold" />
          <p className="mt-6 text-2xl font-bold leading-snug text-navy sm:text-3xl lg:text-4xl">
            La tesis de SUTL no es hacer un mejor tracking. Es convertirse en la capa independiente que une
            abastecimiento, inventario y logística — y que,{' '}
            <span className="text-sky">cuando algo se desvía, asegura que alguien actúe.</span>
          </p>
        </Reveal>
      </section>

      {/* ICP */}
      <section className="relative overflow-hidden bg-navy-radial py-24 text-white sm:py-28">
        <GridPattern id="icp-grid" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeader
            dark
            eyebrow="¿Es para tu empresa?"
            title="Descúbrelo en 30 segundos"
            subtitle="Marca lo que describe a tu operación hoy."
          />
          <Reveal className="mt-14">
            <IcpCheck />
          </Reveal>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <Reveal className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky to-navy p-10 text-center text-white shadow-2xl shadow-navy/20 sm:p-14">
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" aria-hidden />
            <h2 className="relative text-3xl font-extrabold tracking-tight sm:text-4xl">Protege la continuidad de tu abastecimiento</h2>
            <p className="relative mx-auto mt-4 max-w-xl text-white/75">
              Explora la plataforma con datos de muestra o consulta el estado de un envío en el portal público.
            </p>
            <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3.5 text-sm font-semibold text-navy transition-transform hover:-translate-y-0.5"
              >
                Ver la plataforma en vivo
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/tracking"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/30 bg-white/10 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/20"
              >
                <Search size={16} />
                Rastrear un envío
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-navy/10 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
          <div className="col-span-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-navy text-white">
                <Radar size={18} />
              </span>
              <span className="text-lg font-extrabold">SUTL</span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-navy/55">
              Managed Supply Chain Control Tower. Plataforma tecnológica + orquestación humana de abastecimiento y
              logística. Hecho en Ecuador.
            </p>
          </div>
          <div>
            <p className="text-sm font-bold">Producto</p>
            <ul className="mt-4 space-y-2.5 text-sm text-navy/55">
              <li><a href="#servicios" className="hover:text-navy">Servicios</a></li>
              <li><a href="#plataforma" className="hover:text-navy">Plataforma</a></li>
              <li><a href="#motor-de-riesgo" className="hover:text-navy">Motor de riesgo</a></li>
              <li><a href="#piloto" className="hover:text-navy">Piloto</a></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-bold">Accesos</p>
            <ul className="mt-4 space-y-2.5 text-sm text-navy/55">
              <li><Link href="/login" className="hover:text-navy">Panel de clientes</Link></li>
              <li><Link href="/tracking" className="hover:text-navy">Rastrear envío</Link></li>
              <li><a href="#industrias" className="hover:text-navy">Industrias</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-navy/5 py-6 text-center text-xs text-navy/40">
          © {new Date().getFullYear()} SUTL — un producto de SVK Solutions.
        </div>
      </footer>
    </main>
  );
}
