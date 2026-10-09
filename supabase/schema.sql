-- SUTL — schema inicial para Supabase (Fase 1: tenants/users/shipments)
--
-- ⚠️ Desde la revisión "ERP logístico" (Partners, Quotes, Bookings, Rates,
-- Contracts, Invoices, Payments, Containers, Warehouses, Vehicles, etc.),
-- backend/prisma/schema.prisma es la ÚNICA fuente de verdad del esquema —
-- este archivo dejó de mantenerse tabla por tabla porque duplicarlo a mano
-- con ~20 modelos nuevos es propenso a desincronizarse. Para aplicar el
-- esquema completo actual a Supabase, usa Prisma directamente:
--   npx prisma migrate dev --name init   (interactivo, genera la migración)
--   npx prisma db push                   (sin historial de migraciones, más rápido en dev)
-- Es 100% Postgres estándar — migrar a AWS RDS Aurora después no requiere
-- cambios de schema, solo actualizar DATABASE_URL/DIRECT_URL.
--
-- Lo de abajo queda como referencia histórica de las 3 tablas originales
-- (tenants/users/shipments) para quien prefiera inspeccionar el modelo base
-- sin instalar Node — ya no reflejan las columnas nuevas de shipments
-- (tipo, modo, carrierId, bookingId, containerId, etc.) ni las tablas del ERP.

create extension if not exists "pgcrypto";

create type "RolUsuario" as enum ('super_admin', 'admin_tenant', 'operador', 'cliente_final');
create type "EstadoEnvio" as enum ('creado', 'en_transito', 'en_aduana', 'entregado', 'incidencia');

create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  ruc text unique,
  plan text not null default 'trial',
  activo boolean not null default true,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  "tenantId" uuid not null references tenants(id),
  email text not null,
  password text not null,
  nombre text not null,
  rol "RolUsuario" not null default 'operador',
  activo boolean not null default true,
  "refreshTokenHash" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("tenantId", email)
);
create index if not exists users_tenant_idx on users ("tenantId");

create table if not exists shipments (
  id uuid primary key default gen_random_uuid(),
  "tenantId" uuid not null references tenants(id),
  "codigoGuia" text not null unique,
  "remitenteNombre" text not null,
  "destinatarioNombre" text not null,
  "destinatarioEmail" text,
  origen text not null,
  destino text not null,
  estado "EstadoEnvio" not null default 'creado',
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index if not exists shipments_tenant_idx on shipments ("tenantId");

-- Nota sobre RLS: el aislamiento multi-tenant de SUTL se aplica en la capa de
-- aplicación (NestJS: JwtAuthGuard + tenantId del JWT en cada query de
-- Prisma), no vía Supabase Row Level Security, porque el backend accede a la
-- base con una conexión de servicio (DATABASE_URL), no con supabase-js desde
-- el cliente. Si en el futuro se expone Supabase directamente al frontend,
-- activar RLS por tenant_id en cada tabla antes de hacerlo.
