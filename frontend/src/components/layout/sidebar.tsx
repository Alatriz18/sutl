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
  Contact,
  FileSpreadsheet,
  CalendarCheck,
  DollarSign,
  Receipt,
  Container,
  Warehouse,
  Truck,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { DEMO_MODE } from '@/lib/api';
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
    label: 'Comercial',
    items: [
      { href: '/dashboard/cotizaciones', label: 'Cotizaciones', icon: FileSpreadsheet },
      { href: '/dashboard/reservas', label: 'Reservas', icon: CalendarCheck },
      { href: '/dashboard/contactos', label: 'Clientes y proveedores', icon: Contact },
      { href: '/dashboard/tarifas', label: 'Tarifas y contratos', icon: DollarSign },
      { href: '/dashboard/facturacion', label: 'Facturación', icon: Receipt },
    ],
  },
  {
    label: 'Operaciones',
    items: [
      { href: '/dashboard/navieras', label: 'Navieras y aerolíneas', icon: Ship },
      { href: '/dashboard/contenedores', label: 'Contenedores', icon: Container },
      { href: '/dashboard/documentos', label: 'Documentos', icon: FileText },
      { href: '/dashboard/alertas', label: 'Alertas', icon: AlertTriangle },
      { href: '/dashboard/notificaciones', label: 'Notificaciones', icon: Bell },
      { href: '/dashboard/reportes', label: 'Reportes', icon: BarChart3 },
    ],
  },
  {
    label: 'Recursos',
    items: [
      { href: '/dashboard/almacen', label: 'Almacén', icon: Warehouse },
      { href: '/dashboard/flota', label: 'Flota y choferes', icon: Truck },
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
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex h-screen w-64 flex-col justify-between overflow-y-auto border-r border-navy/10 bg-navy text-white transition-transform duration-200 lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div>
          <div className="flex items-center justify-between px-6 py-5">
            <div>
              <span className="text-xl font-bold">SUTL</span>
              <p className="text-xs text-sky-200">Tracking Logístico</p>
              {DEMO_MODE && (
                <span className="mt-1 inline-block rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold">
                  Modo demo
                </span>
              )}
            </div>
            <button onClick={onClose} className="text-sky-200 hover:text-white lg:hidden">
              <X size={20} />
            </button>
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
                          onClick={onClose}
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
    </>
  );
}
