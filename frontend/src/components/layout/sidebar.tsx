'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, Ship, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { DEMO_MODE } from '@/lib/api';
import { navGroups, initialsFromEmail, ROL_LABELS } from '@/lib/nav';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <>
      {/* Overlay móvil */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-navy/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex h-screen w-64 flex-col justify-between overflow-y-auto border-r border-white/5 bg-navy text-white shadow-2xl shadow-black/20 transition-transform duration-200 lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div>
          <div className="flex items-center justify-between px-5 py-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky/15 text-sky">
                <Ship size={16} />
              </span>
              <div>
                <span className="block text-base font-bold leading-tight">SUTL</span>
                <span className="block text-[11px] leading-tight text-sky-300/70">Tracking Logístico</span>
              </div>
            </div>
            <button onClick={onClose} className="text-sky-200 hover:text-white lg:hidden">
              <X size={20} />
            </button>
          </div>

          {DEMO_MODE && (
            <div className="mx-5 mb-2 flex items-center gap-1.5 rounded-md border border-gold/25 bg-gold/10 px-2.5 py-1.5">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-gold">Modo demo</span>
            </div>
          )}

          <nav className="mt-3 flex flex-col gap-5 px-3 pb-4">
            {navGroups.map((group) => {
              const visibleItems = group.items.filter(
                (item) => !item.roles || (user && item.roles.includes(user.rol)),
              );
              if (visibleItems.length === 0) return null;

              return (
                <div key={group.label}>
                  <p className="px-3 pb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-sky-300/60">
                    {group.label}
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {visibleItems.map((item) => {
                      const Icon = item.icon;
                      // /dashboard (Resumen) solo por coincidencia exacta: si no,
                      // quedaría activo en todas las subpáginas del panel.
                      const active =
                        pathname === item.href ||
                        (item.href !== '/dashboard' && pathname?.startsWith(`${item.href}/`));
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={onClose}
                          className={cn(
                            'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                            active ? 'bg-white/10 text-white' : 'text-sky-100/80 hover:bg-white/5 hover:text-white',
                          )}
                        >
                          <span
                            className={cn(
                              'absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-sky transition-opacity',
                              active ? 'opacity-100' : 'opacity-0',
                            )}
                          />
                          <Icon size={17} className={active ? 'text-sky' : 'text-sky-200/60 group-hover:text-sky-100'} />
                          <span className="flex-1">{item.label}</span>
                          {item.badge && (
                            <span className="rounded-full bg-gold/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gold">
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-white/10 px-4 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky/20 text-xs font-semibold text-sky-100">
              {initialsFromEmail(user?.email)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-white">{user?.email}</p>
              <p className="text-[11px] text-sky-300/70">{user ? ROL_LABELS[user.rol] : ''}</p>
            </div>
            <button
              onClick={logout}
              aria-label="Cerrar sesión"
              className="shrink-0 rounded-md p-1.5 text-sky-200/70 hover:bg-white/10 hover:text-white"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
