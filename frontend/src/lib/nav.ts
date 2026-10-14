import {
  LayoutDashboard,
  Package,
  Users,
  Building2,
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
  type LucideIcon,
} from 'lucide-react';
import { RolUsuario } from '@/types';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: RolUsuario[];
  badge?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
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

export const allNavItems: NavItem[] = navGroups.flatMap((g) => g.items);

export function navLabelFor(pathname: string): string {
  const exact = allNavItems.find((item) => item.href === pathname);
  if (exact) return exact.label;
  const prefix = allNavItems
    .filter((item) => item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return prefix?.label ?? 'Resumen';
}

export const ROL_LABELS: Record<RolUsuario, string> = {
  super_admin: 'Super admin',
  admin_tenant: 'Administrador',
  operador: 'Operador',
  cliente_final: 'Cliente',
};

export function initialsFromEmail(email?: string | null): string {
  if (!email) return '?';
  const name = email.split('@')[0];
  const parts = name.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
