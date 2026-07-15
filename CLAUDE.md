# CLAUDE.md — Contexto del proyecto SUTL

Este archivo le da contexto a Claude Code para trabajar en este repositorio. Léelo completo antes de escribir código.

## Qué es SUTL

**SUTL (Sistema Universal de Tracking Logístico)** es una plataforma SaaS B2B multi-tenant de tracking logístico para el mercado de Ecuador y LATAM. Empresas de transporte/logística se suscriben a SUTL y usan el sistema para:

- Registrar envíos/guías y su ciclo de vida (creado → en tránsito → en aduana → entregado → incidencia).
- Registrar eventos de tracking en tiempo real (ubicación, estado, timestamp, responsable).
- Dar visibilidad a sus propios clientes finales de dónde está su envío (portal de seguimiento público por código de guía).
- Administrar su cuenta desde un panel SaaS (usuarios, planes, facturación).

Es un proyecto propio de **SVK Solutions** (Kevin Santana), actualmente en etapa de levantamiento de inversión ($10,000 USD, deck de inversionista ya generado) y con un plan de 6 fases / 16 semanas.

## Desarrollador y contexto de negocio

- Kevin Santana — Full-Stack Lead & Arquitecto. Ingeniero en Sistemas, Ecuador.
- Un desarrollador de apoyo (junior) colabora en frontend/backend por contrato de entregables.
- Comunicación informal y directa en español. Prefiere reemplazos completos de archivo antes que diffs parciales.
- Commits con prefijo `feat:`. Windows + PowerShell como entorno local.
- Otros proyectos de Kevin usan Django+React (SGD, laboratorio clínico), pero **SUTL usa Node.js/NestJS + Next.js**, no Django. No mezclar convenciones.

## Stack técnico (obligatorio, no cambiar sin confirmar con Kevin)

- **Backend**: NestJS (TypeScript), arquitectura modular por dominio (`src/modules/*`), REST API, autenticación JWT (access + refresh token).
- **Frontend**: Next.js 14 con App Router, TypeScript, Tailwind CSS, shadcn/ui para componentes.
- **Bases de datos**:
  - PostgreSQL → datos transaccionales (tenants, usuarios, envíos, facturación). Usar Prisma como ORM.
  - MongoDB Atlas → eventos de tracking de alta escritura (histórico de posiciones/estados por guía). Usar Mongoose.
- **Infraestructura**: Docker Compose en desarrollo local. AWS RDS Aurora en producción (Postgres). Frontend en Vercel.
- **Seguridad**: TLS 1.3, cifrado AES-256 en reposo para datos sensibles, aislamiento estricto multi-tenant (todo query debe filtrar por `tenant_id`), cumplimiento OWASP.

## Arquitectura multi-tenant

Cada empresa logística que se suscribe a SUTL es un **tenant**. Modelo de aislamiento: **fila compartida con `tenant_id`** (no schema-per-tenant, para simplificar operación en fase inicial). Reglas:

- Toda tabla de negocio (envíos, eventos, usuarios) incluye `tenant_id` obligatorio.
- Todo guard/interceptor de NestJS debe inyectar y validar el `tenant_id` del JWT en cada request.
- Nunca exponer datos entre tenants, incluso en endpoints de admin (usar un rol `super_admin` separado y explícito para el panel SaaS).

## Módulos de la Fase 1 (arquitectura base)

1. `auth` — registro/login, JWT access+refresh, guard de tenant, roles (`super_admin`, `admin_tenant`, `operador`, `cliente_final`).
2. `tenants` — CRUD de empresas suscriptoras, plan contratado, estado de cuenta.
3. `users` — usuarios dentro de un tenant, roles y permisos.
4. `shipments` — envíos/guías: creación, estados, datos del remitente/destinatario.
5. `tracking-events` — eventos de tracking asociados a un envío (Mongo).

Estos módulos ya existen como carpetas vacías en `backend/src/modules/`. Falta implementar entidades, DTOs, servicios, controladores y tests.

## Convenciones de código

- TypeScript estricto (`strict: true`) en backend y frontend.
- Backend: un módulo NestJS por dominio, con `*.controller.ts`, `*.service.ts`, `*.module.ts`, `dto/`, `entities/`.
- Frontend: componentes en `src/components`, rutas en `app/` siguiendo App Router, hooks/lib en `src/lib`.
- Validación de entrada con `class-validator` en DTOs del backend.
- Nombrar variables y comentarios de negocio en español; nombres de código (funciones, clases, variables técnicas) en inglés, siguiendo convención estándar de la industria.

## Qué NO hacer

- No introducir Django/Python en este repo — es un proyecto Node.js/NestJS puro.
- No hardcodear credenciales ni strings de conexión — todo va en `.env` (ver `.env.example`).
- No romper el aislamiento multi-tenant por conveniencia de desarrollo.
- No agregar la app móvil (React Native) todavía — está fuera del alcance de la Fase 1.

## Estado actual

Repositorio recién inicializado con la estructura base (Fase 1 — Arquitectura). Próximos pasos sugeridos para Claude Code:

1. Completar `package.json` de backend y frontend con dependencias reales e instalar (`npm install`).
2. Configurar Prisma (schema inicial: `Tenant`, `User`, `Shipment`) y correr la primera migración.
3. Implementar el módulo `auth` completo (registro, login, JWT, guard de tenant).
4. Levantar `docker-compose up` y validar que backend, frontend y Postgres corran correctamente juntos.
5. Crear el primer endpoint protegido de prueba (`GET /shipments`) filtrado por tenant.
