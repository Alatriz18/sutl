import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-navy px-6 text-center text-white">
      <h1 className="text-4xl font-bold">SUTL</h1>
      <p className="max-w-md text-sky-200">
        Sistema Universal de Tracking Logístico — plataforma SaaS de tracking
        logístico para Ecuador y LATAM.
      </p>
      <div className="flex gap-4">
        <Link
          href="/tracking"
          className="rounded-md bg-sky px-5 py-2.5 text-sm font-medium text-white hover:bg-sky/90"
        >
          Rastrear un envío
        </Link>
        <Link
          href="/login"
          className="rounded-md border border-white/30 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/10"
        >
          Ingresar al panel
        </Link>
      </div>
    </main>
  );
}
