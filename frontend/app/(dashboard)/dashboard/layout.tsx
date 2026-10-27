'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';

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
      <div className="flex min-h-screen items-center justify-center gap-3 bg-slate-50 text-navy/50">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-navy/20 border-t-navy" />
        <span className="text-sm">Cargando...</span>
      </div>
    );
  }

  return (
    // h-screen + overflow-hidden (en vez de min-h-screen) para que el alto
    // quede fijado al viewport: así es <main> quien scrollea por dentro y el
    // sidebar queda siempre visible, en vez de que la página entera scrollee
    // y se lleve el sidebar con ella.
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex h-screen flex-1 flex-col overflow-hidden">
        <Topbar onOpenMenu={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
