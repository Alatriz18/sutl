'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Menu } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Sidebar } from '@/components/layout/sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-navy/60">
        Cargando...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex min-h-screen flex-1 flex-col lg:pl-0">
        <header className="flex items-center gap-3 border-b border-navy/10 bg-white px-4 py-3 lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-navy/70 hover:text-navy"
            aria-label="Abrir menú"
          >
            <Menu size={22} />
          </button>
          <span className="font-bold text-navy">SUTL</span>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
