# Estado del proyecto — SUTL

Documento vivo. Registra, en orden cronológico inverso (lo más reciente arriba), qué se hizo, en qué se diverge del `Plan Maestro de Arranque y Desarrollo v1.0` (30 sep 2026, SVK Solutions) y qué falta. Se actualiza cada vez que se agrega una pieza de trabajo significativa — módulo nuevo, decisión de arquitectura, despliegue, etc.

El Plan Maestro es la referencia de timeline/roles/fases (ver PDF entregado por Kevin el 2026-10-08). Este archivo es el *estado real*, que ya diverge del plan en varios puntos (ver sección "Brechas vs. el plan" abajo).

## Resumen rápido de dónde estamos (2026-10-26)

- **Frontend**: Next.js 14 con prácticamente todos los módulos de UI de un ERP logístico completo ya construidos (envíos, tracking, cotizaciones, reservas, tarifas/contratos, facturación, contenedores, almacén, flota, documentos, alertas, notificaciones, reportes, integraciones, panel SaaS de tenants/usuarios/plan). Landing page, login y tracking público con estética corporativa premium, responsive, y un **modo demo** (`NEXT_PUBLIC_DEMO_MODE=true`) que simula toda la API en el navegador con datos de muestra — desplegado en Vercel. Ahora además tiene lint configurado (`next lint`, limpio) y una primera suite e2e con Playwright (`npm run test:e2e`, 6 pruebas del flujo principal, todas en verde).
- **Backend**: todos los módulos NestJS existen y **ya corren de verdad** contra Postgres + MongoDB reales (local, vía Docker Compose — `docker compose up -d postgres mongo` + `prisma migrate deploy` + seed). Se hizo una pasada de seguridad real (ver más abajo) y hay dos suites de tests (unitarios con Jest + e2e con Supertest) que pasan en verde contra la base real. Sigue sin desplegarse a ningún entorno compartido (Staging/Producción) — eso sigue pendiente de credenciales de Supabase/Atlas/AWS.
- **Infraestructura real**: local únicamente (Docker Compose, con un bug de YAML corregido). Sigue sin existir AWS, Terraform, Staging, CI en GitHub Actions, ni ClickUp cargado con este plan. El repo está en GitHub (`Alatriz18/sutl`) pero se trabaja directo sobre `main` (sin `develop`, sin ramas protegidas, sin PRs).
- **Lo que el usuario ve hoy en producción (Vercel)**: solo el frontend, en modo demo (datos ficticios en memoria del navegador, sin backend real detrás). El backend real funciona pero vive únicamente en local por ahora.

## Brechas vs. el plan (lo que el plan pide y todavía no existe)

- Sin GitHub Environments / ramas protegidas / flujo de PR — se commitea directo a `main`.
- Sin CI (lint + test + build por PR) — no hay GitHub Actions configurado (aunque `lint` y `test`/`test:e2e` ya funcionan localmente en ambos lados, listos para enchufarse a un workflow).
- Sin Terraform / AWS — ECS, RDS, Atlas, S3, CloudFront, WAF, Secrets Manager: nada desplegado.
- Sin Prisma baseline real contra una base gestionada (Supabase/Atlas) — el schema y las migraciones ya corren limpio contra Postgres real (hoy local), falta solo apuntar `DATABASE_URL`/`DIRECT_URL` a un proyecto Supabase real y repetir `prisma migrate deploy`.
- Sin ADRs (`/docs` solo tiene `ARQUITECTURA.md`, falta ADR-001 multi-tenancy y ADR-002 Postgres+Mongo formales).
- Sin Redis/BullMQ, sin WebSockets, sin integración real de couriers/pagos/SRI — estos módulos del backend existen como CRUDs pero sin las piezas de "Fase 2 avanzada" del plan (API keys/webhooks por tenant ya existen como UI de demo en el frontend — ver módulo Integraciones — pero no como backend real; adaptador de couriers real sigue pendiente).
- Sin observabilidad (Sentry, CloudWatch, Better Stack).
- Cobertura de tests todavía parcial: el patrón de aislamiento por tenant está probado en `shipments` y `users` (e2e) y `shipments` (unitario); el resto de los 17 módulos tiene el mismo fix aplicado pero no su propio test dedicado todavía (ver changelog de hoy).
- Deuda de dependencias: quedan 12 vulnerabilidades de `npm audit` en el backend sin resolver (bajaron de 31) — las que faltan requieren bumps mayores (`@nestjs/cli` v12, `@nestjs/platform-express` v12 por `multer`) que no se aplicaron a ciegas; revisar deliberadamente en una tarea aparte.
- Accesibilidad de formularios: la mayoría de páginas (login incluido) tienen `<label>` sin asociar a su `<input>` (sin `htmlFor`/envoltura) — se corrigió el patrón solo en `shipments/nuevo` (el que tocan las pruebas e2e nuevas, vía el helper `Field`); el resto de formularios del dashboard queda pendiente de la misma pasada.

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
- **Autoabastecimiento** (agregado 2026-10-26): un servicio de autoabastecimiento/reabastecimiento que SUTL ofrece directamente a sus clientes (SVK gestiona el abastecimiento por ellos), no solo software para que el cliente gestione el suyo. Kevin lo quiere como la **última** funcionalidad grande a construir — se hace al final, una vez el resto esté sólido.

## Historial de cambios

### 2026-10-26 (tarde) — backend real + pasada de seguridad y testing
Kevin pidió explícitamente trabajar "en orden", sin dejar nada a medias, con backend y frontend sólidos, todo probado y con seguridad de primer nivel. Esta entrada cubre esa pasada:

- **Backend corriendo de verdad por primera vez**: se corrigió un bug de YAML en `docker-compose.yml` (una línea con un espacio inicial que invalidaba todo el archivo — `docker compose` ni arrancaba). Con eso: `docker compose up -d postgres mongo` + `npx prisma migrate deploy` (las migraciones ya existían, nunca se habían aplicado) + `npm run prisma:seed` + `npm run start:dev` → la API NestJS corre contra Postgres y Mongo reales en `localhost:3001/api`, login real verificado con `curl`.
- **Vulnerabilidad crítica corregida**: `POST /auth/register` era público (`@Public()`) y aceptaba un `tenantId` arbitrario en el body — cualquiera, sin autenticarse, podía crear una cuenta en **cualquier tenant** (fuga de datos entre tenants, el riesgo "crítico" que el propio Plan Maestro señala). El frontend nunca usaba este endpoint. Se restringió a `super_admin` autenticado y se quitó el auto-login (antes secuestraba la sesión del super_admin que llamaba al endpoint, emitiendo tokens del usuario recién creado).
- **Auditoría completa de aislamiento multi-tenant** (los 19 `*.service.ts` del backend, vía agente de exploración dedicado): 0 fugas abiertas, pero 14 servicios tenían un patrón frágil — verificaban pertenencia al tenant con un `findOne`/`findFirst` previo, pero el `update`/`delete` real no repetía el filtro `tenantId` en su propio `where` (seguro hoy porque Prisma no deja pasar el id si el check previo lo bloqueó, pero fragil ante cualquier refactor futuro que se salte el chequeo). Se corrigieron los 14: `shipments`, `users`, `partners`, `rates`, `contracts`, `containers`, `quotes`, `bookings`, `invoices`, `warehouses`, `fleet`, `alerts`, `notifications`, `tracking-events`. Además se encontró y cerró un hueco de autorización real en `rates.service.ts`: cualquier tenant podía editar/desactivar una tarifa **global** (`tenantId: null`) porque la verificación de lectura (que sí incluye las globales a propósito) se reutilizaba para escritura; ahora las mutaciones exigen `tenantId` propio y no nulo.
- **Endurecimiento de seguridad**: `helmet()` (cabeceras HTTP) y `@nestjs/throttler` (rate limiting — 120 req/min global, 5/min específico en `/auth/login` contra fuerza bruta, verificado con 6 intentos seguidos → el 6to devuelve 429). `npm audit fix` bajó las vulnerabilidades de dependencias del backend de 31 a 12 (las que quedan requieren bumps mayores de `@nestjs/cli`/`@nestjs/platform-express`, no se aplicaron a ciegas — ver brechas arriba).
- **Tests del backend, desde cero** (no existía ni un solo test, ni config de Jest e2e): `backend/test/auth.e2e-spec.ts` (9 pruebas: login válido/inválido, enumeración de usuarios, validación de body, register bloqueado sin auth y sin rol, rate limiting) y `backend/test/tenant-isolation.e2e-spec.ts` (6 pruebas: crea 2 tenants reales vía super_admin, prueba que el tenant B no puede leer/listar/modificar envíos ni usuarios del tenant A, y que el tenant A sí puede). Las 15 pruebas e2e corren contra la base de datos real (`npm run test:e2e`) y pasan. Se agregó también `shipments.service.spec.ts` como ejemplo de prueba unitaria con Prisma mockeado (3 pruebas). ESLint del backend no tenía configuración (`npm run lint` nunca había funcionado) — se agregó `.eslintrc.js`; solo salió 1 warning (`any` justificado) en todo el código existente.
- **Frontend**: se agregó configuración de ESLint (`next/core-web-vitals`, no existía — limpio sin warnings) y una primera suite e2e con Playwright (`frontend/e2e/golden-path.spec.ts`, 6 pruebas: landing→login, login inválido, login válido→dashboard poblado, crear envío de punta a punta, tracking público de un código que existe y de uno que no) — `npm run test:e2e`, todas en verde. De paso se corrigió un bug de accesibilidad real en `shipments/nuevo` (los `<label>` no estaban asociados a sus `<input>`, rompía lectores de pantalla y la prueba e2e por igual) envolviendo el control dentro del `<label>`.
- Se construyó el módulo **Integraciones** (`/dashboard/integraciones`, nuevo en el sidebar bajo "Operaciones"): catálogo de proveedores conectables agrupado por categoría (couriers: FedEx/DHL/Servientrega/Laar; e-commerce: Shopify/WooCommerce/Mercado Libre; navieras/aerolíneas vía API: Maersk/IATA CargoWise; ERP/sistemas externos genérico), con conectar/sincronizar/desconectar simulado. Debajo, **API keys** (generar/revocar) y **webhooks salientes** (crear, elegir eventos, probar entrega, eliminar) — esta es la pieza concreta de la visión de "conectividad con sistemas externos" y la base de datos para "tracking universal" (couriers + e-commerce). Nuevos tipos en `types/index.ts` (`Integration`, `IntegrationProvider`, `ApiKey`, `Webhook`) y rutas correspondientes en el adapter demo.
- Bug corregido en el adapter demo: el regex que limpiaba el prefijo `/api` de las rutas (`/^\/api/`) también recortaba por error cualquier endpoint que empezara literalmente con las letras "api", como el nuevo `/api-keys` (quedaba como `-keys`). Se acotó a `/^\/api(?=\/|$)/`.
- Se retomó el desarrollo de SUTL después de una pausa en la que se evaluó (y se descartó por ahora) una idea para un proyecto distinto (portal de soporte centralizado para SuperCías — sistema de estados financieros, repo separado). No se tocó código de SUTL en esa pausa.
- Confirmado con Kevin: el objetivo sigue siendo que SUTL cubra **todo** el espectro de logística (tracking universal, multi-naviera/multi-modo, couriers/e-commerce, facturación integrada, conectividad externa — ver visión de producto arriba), y se agrega **autoabastecimiento** como funcionalidad final a construir al cierre, no ahora.

### 2026-10-19
- Paleta de marca retonada a colores más corporativos: `sky` pasó del cian brillante (#0EA5E9) a un azul acero/marítimo (#2E86AB), `gold` de ámbar neón (#F59E0B) a bronce (#B38A3C). También se atenuaron los colores de estado (éxito/advertencia/crítico) usados como literales en badges de 7 páginas — de verde/ámbar/rojo muy saturados a tonos más sobrios. Favicon actualizado a la misma paleta. Contraste verificado a mano contra navy y blanco.

### 2026-10-13
- Pulida visual del dashboard interno completo (afecta las ~20 pantallas a la vez vía componentes compartidos, sin tocar cada página): `Card` y `StatTile` con sombra/borde más suaves y radio mayor, `Button` con sombra de color y micro-interacción al presionar, spinner de carga en vez de texto plano.
- Se agregó un **topbar persistente** (`src/components/layout/topbar.tsx`) en escritorio y móvil: título de la sección actual, campana de notificaciones y avatar con iniciales del usuario.
- Se extrajo la configuración de navegación del sidebar a `src/lib/nav.ts` (compartida entre sidebar y topbar), y se rediseñó el sidebar: indicador de sección activa con barra lateral, insignia "Modo demo" más visible, pie con avatar + rol del usuario.
- Ajustada la data de muestra (`mock/data.ts`): se agregaron documentos BL/AWB adicionales para que la alerta de "documento faltante" no marque casi todos los envíos (de 9/10 a un número creíble), evitando que el demo se vea "roto" para un inversionista.

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
