# Estado del proyecto — SUTL

Documento vivo. Registra, en orden cronológico inverso (lo más reciente arriba), qué se hizo, en qué se diverge del `Plan Maestro de Arranque y Desarrollo v1.0` (30 sep 2026, SVK Solutions) y qué falta. Se actualiza cada vez que se agrega una pieza de trabajo significativa — módulo nuevo, decisión de arquitectura, despliegue, etc.

El Plan Maestro es la referencia de timeline/roles/fases (ver PDF entregado por Kevin el 2026-10-08). Este archivo es el *estado real*, que ya diverge del plan en varios puntos (ver sección "Brechas vs. el plan" abajo).

## Resumen rápido de dónde estamos (2026-10-08)

- **Frontend**: Next.js 14 con prácticamente todos los módulos de UI de un ERP logístico completo ya construidos (envíos, tracking, cotizaciones, reservas, tarifas/contratos, facturación, contenedores, almacén, flota, documentos, alertas, notificaciones, reportes, panel SaaS de tenants/usuarios/plan). Landing page, login y tracking público rediseñados con estética corporativa premium, responsive, y un **modo demo** (`NEXT_PUBLIC_DEMO_MODE=true`) que simula toda la API en el navegador con datos de muestra — ya desplegado en Vercel.
- **Backend**: módulos NestJS creados para todos los dominios de negocio de arriba (controllers/services/DTOs), pero **no desplegado en ningún entorno** — corre solo local vía Docker Compose, sin Postgres/Mongo gestionados todavía (Supabase y Mongo Atlas están documentados como plan en `supabase/README.md` pero las credenciales reales no están configuradas).
- **Infraestructura real**: ninguna todavía. No hay AWS, no hay Terraform, no hay Staging, no hay CI en GitHub Actions, no hay ClickUp cargado con este plan. El repo está en GitHub (`Alatriz18/sutl`) pero se trabaja directo sobre `main` (sin `develop`, sin ramas protegidas, sin PRs).
- **Lo que el usuario ve hoy en producción**: solo el frontend en Vercel, en modo demo (datos ficticios en memoria del navegador, sin backend real detrás).

## Brechas vs. el plan (lo que el plan pide y todavía no existe)

- Sin GitHub Environments / ramas protegidas / flujo de PR — se commitea directo a `main`.
- Sin CI (lint + test + build por PR) — no hay GitHub Actions configurado.
- Sin tests (unitarios, e2e, Supertest, Playwright) en ninguno de los dos lados.
- Sin Terraform / AWS — ECS, RDS, Atlas, S3, CloudFront, WAF, Secrets Manager: nada desplegado.
- Sin Prisma baseline real contra una base gestionada (Supabase/Atlas) — el schema existe pero no se migró a un entorno compartido.
- Sin ADRs (`/docs` solo tiene `ARQUITECTURA.md`, falta ADR-001 multi-tenancy y ADR-002 Postgres+Mongo formales).
- Sin Redis/BullMQ, sin WebSockets, sin integración real de couriers/pagos/SRI — estos módulos del backend existen como CRUDs pero sin las piezas de "Fase 2 avanzada" del plan (rate limiting, webhooks firmados, API keys por tenant, adaptador de couriers).
- Sin observabilidad (Sentry, CloudWatch, Better Stack).

## Adelantos vs. el plan (lo que ya está más avanzado de lo esperado para esta fecha)

Según el plan, el 2026-10-08 deberíamos estar en el día 4 del Sprint 1 (Terraform base + seed de prueba). En la práctica, **ya existe mucho más superficie de producto** que lo que el Sprint 1-10 cubre en el plan: todos los módulos de negocio de las fases F2-F4 (cotizaciones, reservas, tarifas, facturación, contenedores, almacén, flota, documentos, alertas, notificaciones, reportes) ya tienen CRUD de backend y UI de frontend, aunque sin pruebas ni infraestructura real detrás. El frontend además ya tiene una landing page pública de nivel inversionista.

## Visión de producto (más allá del plan de 12 sprints)

Kevin quiere que SUTL sea la plataforma de logística más completa del mercado, no solo lo que cubre el roadmap de 24 semanas. Puntos clave a tener en mente al priorizar backlog (detalle completo en memoria `sutl-product-vision`):

- Tracking universal **bidireccional**: compras (importación) y ventas (exportación) con el mismo nivel de detalle.
- Integración amplia de modos: navieras, buques, contenedores, aerolíneas — no solo un modo.
- Integración con couriers y e-commerce (compras en línea, tiendas), no solo carga B2B.
- Operación logística puntual — el software debe *operar* el día a día, no solo visualizarlo.
- Facturación integrada en cada operación/envío, no como módulo aislado.
- Conectividad con sistemas externos de terceros (hub de integración, no isla cerrada).

## Historial de cambios

### 2026-10-08
- Se agregó modo demo completo (`frontend/src/lib/mock/`) que simula toda la API REST en el navegador — login, shipments, tracking-events, quotes, bookings, rates, contracts, invoices+pagos, containers, warehouses+inventory, vehicles+drivers, documents (con descarga simulada), alerts (evaluación dinámica), notifications, reports (CSV real generado en cliente). Activado vía `NEXT_PUBLIC_DEMO_MODE=true`.
- Se desplegó el frontend a Vercel (proyecto `sutl`, root directory `frontend`) conectado al repo de GitHub, con el modo demo activo.
- Se rediseñó la landing page (`/`), login (`/login`) y búsqueda de tracking (`/tracking`) con estética corporativa premium: gradiente navy, mockup de dashboard en CSS, tipografía Plus Jakarta Sans, grid de features, sección "cómo funciona", CTA final. Verificado responsive (sin overflow horizontal) en viewport mobile.
- Se recibió y se registró el `Plan Maestro de Arranque y Desarrollo v1.0` como referencia oficial de timeline/roles/fases (ver memoria `sutl-master-plan`).
- Se recibió la visión de producto ampliada de Kevin (tracking universal, multi-carrier, invoicing integrado, conectividad externa) — registrada en memoria `sutl-product-vision`.

### Antes de 2026-10-08 (estado heredado, sin changelog detallado previo)
- Scaffold inicial del monorepo (NestJS + Next.js + Docker Compose + CLAUDE.md).
- Módulos de backend creados: auth, tenants, users, shipments, tracking-events, alerts, bookings, containers, contracts, documents, fleet, invoices, notifications, partners, quotes, rates, reports, warehouses.
- Todas las pantallas de dashboard correspondientes en el frontend.
- `supabase/schema.sql` y `supabase/README.md` documentando el plan de usar Supabase como Postgres gestionado (no configurado aún con credenciales reales).
