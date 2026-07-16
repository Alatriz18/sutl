'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Users,
  Building2,
  LogOut,
  FileText,
  Bell,
  AlertTriangle,
  BarChart3,
  Ship,
  CreditCard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { RolUsuario } from '@/types';

interface MenuItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: RolUsuario[];
  badge?: string;
}

interface MenuGroup {
  label: string;
  items: MenuItem[];
}

const menuGroups: MenuGroup[] = [
  {
    label: 'Principal',
    items: [
      { href: '/dashboard', label: 'Resumen', icon: LayoutDashboard },
      { href: '/dashboard/shipments', label: 'Envíos', icon: Package },
    ],
  },
  {
    label: 'Operaciones',
    items: [
      { href: '/dashboard/navieras', label: 'Navieras y aerolíneas', icon: Ship },
      { href: '/dashboard/documentos', label: 'Documentos', icon: FileText, badge: 'demo' },
      { href: '/dashboard/alertas', label: 'Alertas', icon: AlertTriangle, badge: 'demo' },
      { href: '/dashboard/notificaciones', label: 'Notificaciones', icon: Bell, badge: 'demo' },
      { href: '/dashboard/reportes', label: 'Reportes', icon: BarChart3, badge: 'demo' },
    ],
  },
  {
    label: 'Administración',
    items: [
      {
        href: '/dashboard/users',
        label: 'Usuarios',
        icon: Users,
        roles: ['admin_tenant', 'super_admin'],
      },
      {
        href: '/dashboard/tenants',
        label: 'Empresas (tenants)',
        icon: Building2,
        roles: ['super_admin'],
      },
      {
        href: '/dashboard/plan',
        label: 'Plan y facturación',
        icon: CreditCard,
        roles: ['admin_tenant', 'super_admin'],
        badge: 'demo',
      },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="flex h-screen w-64 flex-col justify-between overflow-y-auto border-r border-navy/10 bg-navy text-white">
      <div>
        <div className="px-6 py-5">
          <span className="text-xl font-bold">SUTL</span>
          <p className="text-xs text-sky-200">Tracking Logístico</p>
        </div>
        <nav className="mt-2 flex flex-col gap-4 px-3 pb-4">
          {menuGroups.map((group) => {
            const visibleItems = group.items.filter(
              (item) => !item.roles || (user && item.roles.includes(user.rol)),
            );
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.label}>
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-sky-300/70">
                  {group.label}
                </p>
                <div className="flex flex-col gap-1">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const active =
                      pathname === item.href || pathname?.startsWith(`${item.href}/`);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                          active ? 'bg-sky text-white' : 'text-sky-100 hover:bg-white/10',
                        )}
                      >
                        <Icon size={18} />
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
        <p className="truncate text-xs text-sky-200">{user?.email}</p>
        <p className="mb-3 text-xs capitalize text-sky-300">{user?.rol.replace('_', ' ')}</p>
        <button
          onClick={logout}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-sky-100 hover:bg-white/10"
        >
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
