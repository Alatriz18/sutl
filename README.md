# SUTL — Sistema Universal de Tracking Logístico

Plataforma SaaS B2B de tracking logístico multi-tenant para Ecuador/LATAM.

Desarrollado por **SVK Solutions** — Kevin Santana
> "Si lo puedes imaginar, yo lo puedo programar"

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Frontend Web | Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui |
| Backend / API | Node.js + NestJS + REST API (JWT Auth) |
| Base de datos | PostgreSQL (datos transaccionales) + MongoDB Atlas (eventos de tracking / logs de alta escritura) |
| Infraestructura | Docker Compose (dev local), AWS RDS Aurora (prod), Vercel (frontend) |
| Seguridad | TLS 1.3, AES-256 en reposo, JWT + refresh tokens, arquitectura multi-tenant aislada, OWASP compliance |
| Móvil (fase futura) | React Native (Expo) — fuera del alcance de la Fase 1 |

## Estructura del monorepo

```
sutl/
├── backend/          # API NestJS
├── frontend/          # Next.js 14 App Router
├── docs/              # Documentación de arquitectura
├── docker-compose.yml
└── CLAUDE.md          # Contexto del proyecto para Claude Code
```

## Fases del proyecto (16 semanas)

- **F1 — Arquitectura** (semana actual): monorepo, Docker Compose, esquema de base de datos, módulo de autenticación multi-tenant, CI/CD base.
- **F2 — Backend & API**: módulos de tracking (envíos, eventos, estados), integraciones, webhooks.
- **F3 — Web App (Next.js)**: dashboard de cliente, seguimiento en tiempo real, mapas.
- **F5 — Panel SaaS Admin**: gestión de tenants, facturación, planes.
- **F6 — DevOps & Seguridad**: hardening, monitoreo, backups, despliegue AWS.
- **F7 — QA & Documentación**: pruebas end-to-end, documentación técnica y de usuario.

## Estado actual (Fase 1 completa)

- `auth`: registro/login, JWT access (15 min) + refresh (7 días, cookie httpOnly), guard global (`JwtAuthGuard` + `@Public()`), guard de roles (`RolesGuard` + `@Roles()`).
- `tenants`: CRUD exclusivo de `super_admin` (panel SaaS).
- `users`: CRUD de usuarios por tenant, siempre filtrado por `tenantId` del JWT.
- `shipments`: CRUD por tenant + endpoint público `GET /api/shipments/tracking/:codigoGuia` (sin auth).
- `tracking-events`: eventos en MongoDB Atlas, asociados a un envío; cada evento nuevo actualiza el estado del `Shipment` en Postgres.
- Frontend: login, dashboard con sidebar por rol (resumen, envíos, usuarios, tenants), portal público `/tracking` y `/tracking/[codigo]`.

## Base de datos — Supabase (Fase 1) → AWS (futuro)

DB inicial en **Supabase** (Postgres free tier). El schema (`backend/prisma/schema.prisma`) es Postgres estándar sin extensiones propietarias, así que migrar a **AWS RDS Aurora** más adelante es solo cambiar `DATABASE_URL`/`DIRECT_URL`. Ver [`supabase/README.md`](supabase/README.md) para el setup paso a paso y [`supabase/schema.sql`](supabase/schema.sql) como referencia SQL del schema.

Eventos de tracking van en **MongoDB Atlas** (free tier M0), no en Supabase — ver `MONGO_URI` en `backend/.env.example`.

## Levantar el entorno de desarrollo

### Opción A — Docker Compose (Postgres local, sin Supabase)

```powershell
cp .env.example .env
cp backend/.env.example backend/.env   # ajustar DATABASE_URL/DIRECT_URL a la variante local (ver comentario en el archivo)
cp frontend/.env.example frontend/.env

docker compose up --build

# Backend:  http://localhost:3001/api
# Frontend: http://localhost:3000
```

### Opción B — Supabase + Mongo Atlas (recomendado, gratis)

```powershell
cp backend/.env.example backend/.env   # completar DATABASE_URL, DIRECT_URL y MONGO_URI reales
cp frontend/.env.example frontend/.env

cd backend
npm install
npm run prisma:migrate -- --name init
npm run prisma:seed        # crea super_admin + tenant demo (ver prisma/seed.ts)
npm run start:dev

cd ../frontend
npm install
npm run dev
```

Usuarios de prueba tras el seed: `admin@sutl.dev` (super_admin), `admin@demo-transportes.com` (admin_tenant) y `operador@demo-transportes.com` (operador) — contraseñas en `backend/prisma/seed.ts`.

## Despliegue objetivo

- **Frontend**: Vercel (`frontend/`), variable `NEXT_PUBLIC_API_URL` apuntando al backend.
- **Backend**: por ahora cualquier host Node (Railway/Render) o el mismo Docker; el `Dockerfile` de `backend/` ya está listo para migrar a un contenedor en AWS (ECS/EB) más adelante sin cambios de código.
- **DB**: Supabase ahora → AWS RDS Aurora después (solo cambia la connection string).

## Próximo paso

Fase 2: refinar validaciones, tests, y llevar el CRUD de `shipments`/`tracking-events` a UI con filtros y paginación real.
