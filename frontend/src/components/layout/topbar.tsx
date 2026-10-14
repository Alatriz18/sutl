'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Menu } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { navLabelFor, initialsFromEmail } from '@/lib/nav';

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const title = navLabelFor(pathname ?? '/dashboard');

  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-navy/10 bg-white/80 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
      <button
        onClick={onOpenMenu}
        className="text-navy/70 hover:text-navy lg:hidden"
        aria-label="Abrir menú"
      >
        <Menu size={22} />
      </button>
      <h2 className="text-sm font-semibold text-navy/80 sm:text-base">{title}</h2>
      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <Link
          href="/dashboard/notificaciones"
          aria-label="Notificaciones"
          className="relative rounded-md p-2 text-navy/50 hover:bg-navy/5 hover:text-navy"
        >
          <Bell size={18} />
        </Link>
        <span className="hidden h-6 w-px bg-navy/10 sm:block" />
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy/10 text-xs font-semibold text-navy">
          {initialsFromEmail(user?.email)}
        </span>
      </div>
    </header>
  );
}
