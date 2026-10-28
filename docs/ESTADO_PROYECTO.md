# Estado del proyecto — SUTL

Documento vivo. Registra, en orden cronológico inverso (lo más reciente arriba), qué se hizo, en qué se diverge del `Plan Maestro de Arranque y Desarrollo v1.0` (30 sep 2026, SVK Solutions) y qué falta. Se actualiza cada vez que se agrega una pieza de trabajo significativa — módulo nuevo, decisión de arquitectura, despliegue, etc.

El Plan Maestro es la referencia de timeline/roles/fases (ver PDF entregado por Kevin el 2026-10-08). Este archivo es el *estado real*, que ya diverge del plan en varios puntos (ver sección "Brechas vs. el plan" abajo).

## Resumen rápido de dónde estamos (2026-10-26)

- **Frontend**: Next.js 14 con prácticamente todos los módulos de UI de un ERP logístico completo ya construidos (envíos, tracking, cotizaciones, reservas, tarifas/contratos, facturación, contenedores, almacén, flota, documentos, alertas, notificaciones, reportes, integraciones, panel SaaS de tenants/usuarios/plan). Landing page, login y tracking público con estética corporativa premium, responsive, y un **modo demo** (`NEXT_PUBLIC_DEMO_MODE=true`) que simula toda la API en el navegador con datos de muestra — desplegado en Vercel. Ahora además tiene lint configurado (`next lint`, limpio) y una primera suite e2e con Playwright (`npm run test:e2e`, 6 pruebas del flujo principal, todas en verde).
- **Backend**: todos los módulos NestJS existen y **ya corren de verdad** contra Postgres + MongoDB reales (local, vía Docker Compose — `docker compose up -d postgres mongo` + `prisma migrate deploy` + seed). Se hizo una pasada de seguridad real (ver más abajo) y hay dos suites de tests (unitarios con Jest + e2e con Supertest) que pasan en verde contra la base real. Sigue sin desplegarse a ningún entorno compartido (Staging/Producción) — eso sigue pendiente de credenciales de Supabase/Atlas/AWS.
- **Infraestructura real**: local únicamente (Docker Compose, con un bug de YAML corregido). Ya existe **CI en GitHub Actions** (`.github/workflows/ci.yml`) que corre lint + build + tests de backend y frontend en cada push/PR a `main` — backend contra Postgres+Mongo reales levantados como servicios del runner. Sigue sin existir AWS, Terraform, Staging, ni ClickUp cargado con este plan. El repo está en GitHub (`Alatriz18/sutl`) pero se trabaja directo sobre `main` (sin `develop`, sin ramas protegidas, sin PRs — el CI valida pero todavía no bloquea nada).
- **Lo que el usuario ve hoy en producción (Vercel)**: solo el frontend, en modo demo (datos ficticios en memoria del navegador, sin backend real detrás). El backend real funciona pero vive únicamente en local por ahora.

## Brechas vs. el plan (lo que el plan pide y todavía no existe)

- Sin GitHub Environments / ramas protegidas / flujo de PR — se commitea directo a `main`. El CI ya corre en cada push a `main`, pero como no hay ramas protegidas, nada impide hacer push aunque el CI vaya a fallar (sigue siendo detección, no prevención).
- CI resuelto: `.github/workflows/ci.yml` corre lint + `tsc --noEmit` + build + tests unitarios + tests e2e del backend (contra Postgres 16 y Mongo 7 reales como servicios del runner, con seed) y lint + build + Playwright del frontend (modo demo). Falta: badge de estado en el README, y que bloquee merges (necesita rama protegida).
- Sin Terraform / AWS — ECS, RDS, Atlas, S3, CloudFront, WAF, Secrets Manager: nada desplegado.
- Sin Prisma baseline real contra una base gestionada (Supabase/Atlas) — el schema y las migraciones ya corren limpio contra Postgres real (hoy local), falta solo apuntar `DATABASE_URL`/`DIRECT_URL` a un proyecto Supabase real y repetir `prisma migrate deploy`.
- Sin ADRs (`/docs` solo tiene `ARQUITECTURA.md`, falta ADR-001 multi-tenancy y ADR-002 Postgres+Mongo formales).
- Sin Redis/BullMQ, sin WebSockets, sin integración real de couriers/pagos/SRI — estos módulos del backend existen como CRUDs pero sin las piezas de "Fase 2 avanzada" del plan (API keys/webhooks por tenant ya existen como UI de demo en el frontend — ver módulo Integraciones — pero no como backend real; adaptador de couriers real sigue pendiente).
- Sin observabilidad (Sentry, CloudWatch, Better Stack).
- Cobertura de tests: el patrón de aislamiento por tenant ya tiene test e2e dedicado en los 17 módulos corregidos (`shipments`, `users`, `partners`, `invoices`, `contracts`, `rates`, `quotes`, `bookings`, `containers`, `fleet` (vehículos/conductores/asignaciones/mantenimiento), `warehouses`/inventario, `alerts`, `notifications`, `tracking-events`) — ver changelog de hoy. `shipments` además tiene test unitario. Lo que falta: cobertura unitaria del resto de servicios (solo hay e2e) y tests para módulos sin lógica de mutación propia (`documents`, `reports`, `subscriptions`, `audit` — CRUDs simples sin el patrón de riesgo que motivó esta pasada).
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

## Giro estratégico — Business Plan 2026 (28 oct 2026)

Fuente: `SUTL_Business_Plan_2026.pdf` entregado por Kevin el 2026-10-28. **Reemplaza el posicionamiento** de "app de tracking logístico para transportistas" por:

> **SUTL — Managed Supply Chain Control Tower.** Plataforma tecnológica + orquestación humana de abastecimiento y logística. *"SUTL no mueve la carga; SUTL orquesta a quienes la mueven y protege la continuidad del abastecimiento."*

**Cambio de cliente**: el cliente ya no es (solo) la empresa de transporte, sino la **empresa que compra/importa/produce** (mediana o grande, 50+ SKU críticos, 3+ operadores logísticos, seguimiento hoy en Excel/correo/WhatsApp). La unidad de valor deja de ser el "tracking" y pasa a ser **la resolución coordinada de excepciones**.

**Tres ofertas**:

| Oferta | Incluye | Cliente ideal |
|---|---|---|
| SUTL Platform | Software, dashboards, documentos, alertas, integraciones, trazabilidad | Empresa con equipo interno robusto |
| SUTL Managed Control Tower | Platform + analista SUTL + seguimiento de proveedores/operadores + gestión de excepciones | Operación compleja, poca capacidad interna |
| SUTL Supply Control | Managed + cobertura de inventario, abastecimiento, riesgo de stock, priorización de compras | Manufactura, alimentos, pharma, importadores |

*Supply Control es la formalización del "autoabastecimiento" que Kevin pidió el 2026-10-26 — sigue siendo la capa final.*

**Pricing (hipótesis a validar, NO precios públicos)**: onboarding USD 2.000–10.000 único · Platform USD 500–2.000/mes · Managed USD 1.500–5.000+/mes · escalones por complejidad · integraciones a cotización. Cobrar por operación controlada, no por usuario.

**Go-to-market**: vertical inicial agroindustria/alimentos o manufactura (pharma como segundo frente tras revisión regulatoria ARCSA) → 15–20 entrevistas → 2–3 design partners → piloto 8–12 semanas con baseline (Diagnóstico 1–2, Configuración 2–3, Operación 4–8, Evaluación 9–10, Conversión 10–12) → convertir al menos un piloto en contrato anual antes de ampliar desarrollo.

**Roadmap de producto del plan**: 0–3 m MVP operable (OC, proveedores, shipments, documentos, inventario básico, dashboard, tareas, alertas por reglas) · 3–6 m Control Tower gestionada (centro de excepciones, SLA, bitácora, KPIs, portal colaborativo) · 6–12 m Supply Control (cobertura, riesgo de stockout, score de proveedor) · 12–18 m Automatización (ingesta de hitos, OCR documental, playbooks) · 18–24 m Escala (benchmarking, multi-país, predictivo, marketplace de conectores).

### Brecha: módulos del Business Plan vs. lo que ya existe en el código

| Módulo del plan (§7.1) | Estado en el repo |
|---|---|
| Control de OCs (órdenes de compra, líneas, proveedor, responsable) | **Hecho (2026-10-28)**: módulo `purchase-orders` con ciclo de vida, recepciones parciales e historial, aislado por tenant y con tests. Falta vínculo OC ↔ embarque ↔ inventario (siguiente paso). |
| Inventario & cobertura (stock, consumo, safety stock, días de cobertura) | Parcial: `warehouses` tiene inventario/stock; falta consumo, cobertura y safety stock. |
| Shipment tracking (hitos, ETD/ETA, BL/AWB, contenedor) | Existe: `shipments`, `tracking-events`, `containers`, `carriers`. Falta enlazar embarque ↔ OC. |
| Movimientos nacionales (despacho, recepción, POD) | Parcial: `fleet`. Falta POD y recepción conectada a OC. |
| Documentos (factura, packing list, BL, certificados) | Existe `documents`. Falta checklist por operación y vencimientos. |
| Exception engine (reglas, severidad, SLA, responsable, escalamiento) | Parcial: `alerts`. Falta SLA, responsable y escalamiento. |
| Control Tower (vista de riesgos y tareas) | Parcial: dashboard actual es de envíos, no de riesgo. |
| Workflow humano (tareas, comentarios, evidencia, bitácora) | **No existe.** |
| Analytics (OTIF, lead time, aging, cumplimiento de proveedor) | Parcial: `reports` sin estas métricas. |
| Portal colaborativo (acceso por rol cliente/proveedor/operador) | Parcial: tracking público. Faltan roles `analista_sutl` y `proveedor` (hoy: `super_admin`, `admin_tenant`, `operador`, `cliente_final`). |
| Motor de riesgo de abastecimiento (§7.2) | **No existe.** Diferenciador clave: días de cobertura, fecha de quiebre vs. fecha de reposición, semáforo y acción recomendada. |
| Seguridad (§7.3): RBAC, MFA, auditoría | RBAC y aislamiento multi-tenant ✓. MFA no existe. Bitácora de auditoría parcial. |

Implicación: varios módulos actuales (cotizaciones, reservas, tarifas/contratos de naviera, flota) responden al cliente *transportista* anterior. No se borran, pero dejan de ser el foco; el backlog nuevo arranca por **OCs → vínculo OC↔embarque↔inventario → motor de riesgo → centro de excepciones + tareas**.

## Historial de cambios

### 2026-10-28 (cont.) — Control de Órdenes de Compra (primer módulo del Business Plan) + fix de escalada de privilegios
Primer paso del backlog nuevo (OCs → vínculo OC↔embarque↔inventario → motor de riesgo → excepciones + tareas).

**Backend — módulo `purchase-orders`** (`backend/src/modules/purchase-orders/`):
- Modelos Prisma `PurchaseOrder`, `PurchaseOrderLine`, `PurchaseOrderReceipt` + enum `EstadoOrdenCompra`. Migración `20261028120000_control_ordenes_compra`. Todas las tablas llevan `tenantId`; el N° de OC es único **por tenant** (dos empresas pueden tener la misma "OC-001").
- Ciclo de vida: `borrador → emitida → confirmada → despachada → recibida_parcial → recibida`, con `cancelada` desde borrador/emitida/confirmada. `recibida_parcial`/`recibida` no se fijan a mano: salen de registrar recepciones.
- Reglas: confirmar exige la fecha comprometida por el proveedor; cancelar exige motivo; líneas, proveedor, número y moneda solo se editan en borrador; OCs recibidas/canceladas no se editan; el proveedor debe ser un `Partner` tipo `proveedor` activo **del mismo tenant** (respuesta genérica, no revela si existe en otro tenant).
- Recepciones: transaccionales (si una línea falla no se guarda ninguna) con incremento condicional atómico — dos recepciones simultáneas no pueden sumar más de lo pedido. Cada recepción queda en historial (quién, cuánto, cuándo, nota).
- Cambios de estado con control de concurrencia (estado actual en el `where`; si otro usuario cambió la OC entre tanto → 409).
- Roles: `admin_tenant`, `operador`, `super_admin`. `cliente_final` recibe 403.
- Endpoints: `GET/POST /purchase-orders` (filtros `estado`, `proveedorId`, `q` por N° o SKU), `GET/PATCH /purchase-orders/:id`, `POST /:id/transicion`, `POST /:id/recepciones`. Visibles en Swagger (`/api/docs`, tag `purchase-orders`).
- Seed: 2 proveedores y 6 OCs de ejemplo en el tenant demo (una en cada estado, con alertas de fecha y una recepción parcial). Idempotente.
- Tests: 15 unitarios (`purchase-orders.service.spec.ts`) + 23 e2e contra Postgres real (`test/purchase-orders.e2e-spec.ts`: flujo completo, validaciones, roles y aislamiento — B no ve, no edita, no transiciona ni recibe la OC de A, ni puede usar un proveedor de A).

**Frontend** — nueva sección "Supply Control → Órdenes de compra" en el sidebar:
- `/dashboard/compras`: KPIs (abiertas, en camino, recepción parcial, con alerta de fecha), filtros por estado, búsqueda por N°/proveedor/SKU, avance de recepción y total.
- `/dashboard/compras/nueva`: cabecera + líneas dinámicas con total en vivo.
- `/dashboard/compras/[id]`: línea de tiempo del estado, alerta de fecha, acción siguiente según estado (emitir / confirmar con fecha / despachar / cancelar con motivo), actualizar la fecha si el proveedor la mueve, registro de recepciones por línea e historial.
- **Alerta de fecha** (señal temprana simple, *no* es el motor de riesgo): roja si la fecha requerida ya pasó o si el proveedor despacha después de la fecha requerida; ámbar si faltan ≤7 días y el proveedor aún no confirma.
- Fechas de `<input type="date">` se envían al mediodía local para que no se corran un día por la zona horaria (UTC-5).
- Modo demo (Vercel): mismas rutas y reglas simuladas en `src/lib/mock/`. Playwright: 2 tests nuevos (8/8 pasan).
- Fix de paso: en el sidebar "Resumen" quedaba resaltado en todas las páginas (coincidía por prefijo con `/dashboard/*`).

**Seguridad — escalada de privilegios corregida (crítico, existía desde antes)**: un `admin_tenant` podía crear un usuario con `rol: super_admin` (o ascender uno existente) vía `POST/PATCH /users`, y con eso administrar **todas** las empresas (crear tenants, registrar usuarios en cualquier tenant). Ahora solo un `super_admin` puede asignar ese rol, y un `admin_tenant` tampoco puede editar ni desactivar a un `super_admin` (403). Test nuevo `test/users-roles.e2e-spec.ts`, verificado que **falla sin el fix** y pasa con él. Se borraron de la base local los 2 `super_admin` que esa verificación creó.

**Pendiente detectado (no corregido aún)**: varios `create` existentes (ej. `bookings`, `invoices`, `quotes`) aceptan un `clienteId`/`partnerId` sin validar que pertenezca al tenant del usuario — permite referenciar (y ver vía `include`) un partner de otra empresa si se conoce su UUID. Riesgo bajo (UUID no adivinable) pero rompe el aislamiento; el módulo de OCs ya lo valida. Corregir en la próxima pasada.

Totales: backend 18 unitarios + 64 e2e, frontend 8 e2e — todo en verde. Lint, `tsc` y build de producción limpios.

### 2026-10-28 — Business Plan 2026 incorporado + landing rediseñada con el nuevo posicionamiento
Kevin entregó `SUTL_Business_Plan_2026.pdf` (giro a *Managed Supply Chain Control Tower*) y pidió anotarlo en el plan y rehacer la web pública "magistral, llamativa y con todo".

- **Plan**: nueva sección "Giro estratégico — Business Plan 2026" arriba en este documento, con las 3 ofertas, pricing como hipótesis, go-to-market, roadmap del plan y una **tabla de brechas módulo por módulo** contra el código actual (lo más importante: no existen todavía Control de OCs, motor de riesgo de abastecimiento ni workflow humano/tareas).
- **Landing (`frontend/app/page.tsx`) reescrita completa** alrededor del mensaje *"SUTL no mueve la carga. Orquesta a quienes la mueven."* Secciones: hero con mockup animado de control tower (centro de excepciones rotando, cadena Proveedor→Forwarder→Aduana→Bodega→Planta) · fuentes que unifica (marquee) · cifras de mercado de Ecuador con fuente (BCE, ENL 2023) · los 6 dolores → respuesta SUTL · mapa de orquestación interactivo por actor ("sigue siendo responsable de" vs "SUTL hace") · las 3 ofertas + modelo de precio **sin cifras** · los 10 módulos de la plataforma (MVP + evolución) · **simulador interactivo del motor de riesgo** (días de cobertura vs. ETA + variabilidad → semáforo y acción recomendada) · valor por área en pestañas · cadencia operativa + matriz RACI · industrias con nivel de encaje y nota ARCSA para pharma · competencia y sustitutos · piloto de 12 semanas en Gantt · roadmap 0–24 meses · seguridad · tesis · autoevaluación de cliente ideal (6 criterios del ICP) · CTA y footer.
- Componentes nuevos en `frontend/src/components/landing/` (nav con menú móvil, reveal/count-up con `IntersectionObserver`, mockup, hub, simulador, pestañas, checklist ICP). Animaciones respetan `prefers-reduced-motion`. Metadata del sitio actualizada al nuevo posicionamiento.
- **Decisiones de honestidad del contenido**: los rangos de precio del plan *no* se publican (el propio plan dice que son hipótesis); los ahorros no se prometen con números; no se lista MFA como característica (no existe aún); la frase del piloto se ajustó para no prometer "sin resultados no hay contrato".
- Verificado: lint y `tsc` limpios, build de producción OK (`/` = 9,7 kB), sin scroll horizontal a 390 px, capturas revisadas en escritorio y móvil, simulador probado con interacción real. Suite e2e del modo demo 6/6 (se actualizó la aserción del título del hero).
- Pendiente: la web no tiene todavía un canal de contacto real (formulario/correo/WhatsApp para "agendar diagnóstico") — falta que Kevin defina a dónde deben llegar los leads.

### 2026-10-27 (cont.) — documentación Swagger/OpenAPI de la API real
Kevin preguntó cómo seguir con "las APIs y demás" de cara a presentar avances. Antes de auditar módulo por módulo (pendiente, ver abajo), se agregó documentación interactiva de la API — mayor impacto inmediato para mostrarle a un inversionista la superficie real del backend sin depender de Postman/curl.

- `@nestjs/swagger@^7.4.2` instalado (la v12 más reciente pide `@nestjs/common` v12, incompatible con Nest 10 actual de este repo — se fijó la v7, compatible con Nest 9/10).
- `backend/src/main.ts`: `SwaggerModule` montado en `GET /api/docs` (UI) y `/api/docs-json` (spec), **solo fuera de producción** (`NODE_ENV !== 'production'`) — no queremos la documentación de la API expuesta públicamente más adelante. Helmet relaja su CSP únicamente en ese mismo caso (Swagger UI necesita `<style>`/`<script>` inline; en producción el CSP estricto queda intacto).
- Los 19 controladores (los 18 módulos de dominio + `auth`) llevan ahora `@ApiTags('<módulo>')` para que la UI los agrupe por dominio. Verificado: 19 tags, 51 endpoints documentados en `/api/docs-json`.
- No se tocó el guard global de JWT ni las DTOs — esto es puramente documentación, no cambia comportamiento de ningún endpoint. Build (`npm run build`) y lint quedaron limpios.
- Pendiente: los DTOs no tienen decoradores `@ApiProperty` todavía, así que Swagger infiere los tipos pero no muestra descripciones/ejemplos — mejora cosmética para otra pasada, no bloqueante para presentar.
- Próximo paso acordado con Kevin: auditar los 18 módulos uno por uno (¿el servicio pega a Postgres/Mongo real o hay algo a medias?, ¿la pantalla del frontend llama al endpoint real?) — no iniciado todavía.

### 2026-10-27 — backend real corriendo en local + bug crítico de deadlock en el login del frontend
Kevin pidió levantar todo en local (backend real, no modo demo) para poder presentar avances semanalmente sin depender de un despliegue en la nube todavía. Al probarlo en el navegador apareció un bug real.

- **Entorno local real operativo**: `docker compose up -d postgres mongo` + `prisma migrate deploy` + seed + `backend: npm run start:dev` + `frontend: npm run dev` (sin `NEXT_PUBLIC_DEMO_MODE`, es decir, contra el backend real). Login verificado end-to-end contra la base de datos real. Para la próxima sesión, estos mismos 4 comandos levantan todo de nuevo.
- **Bug crítico encontrado y corregido — deadlock en el refresco de sesión** (`frontend/src/lib/api.ts`): el interceptor de axios que reintenta una petición tras un 401 refrescando el token no distinguía cuando la petición que falló con 401 era *la propia llamada de refresh* (caso normal: visitante sin sesión activa, cookie vencida). Al fallar, intentaba "refrescar el refresh", generando una promesa que termina esperándose a sí misma — un deadlock real de JavaScript, no un timeout. El resultado visible: el login se quedaba en "Ingresando..." o el dashboard en "Cargando..." para siempre, de forma intermitente (dependía de timing de microtasks). Esto llevaba tiempo presente en el código pero nunca se había notado porque el modo demo (el único que se había probado de punta a punta hasta ahora) no pasa por este interceptor en absoluto. Fix: excluir explícitamente las peticiones a `/auth/refresh` de este mecanismo de reintento. Diagnosticado con un test de Playwright instrumentado con logging de ciclo de vida (no se pudo diagnosticar solo con la consola del navegador — el deadlock no deja rastro, solo cuelga).
- **Primer diagnóstico del sidebar fue parcialmente incorrecto**: se verificó en 9 anchos de pantalla (375px–1920px) que el colapso a menú hamburguesa por debajo de 1024px funciona bien — eso sí era solo un efecto del deadlock de sesión (con la sesión colgada, el dashboard nunca pintaba nada). Pero Kevin reportó un segundo síntoma real después del fix: **la página completa scrolleaba en vez de solo el contenido**, arrastrando el sidebar (su logo se iba fuera de pantalla al bajar). Causa: el layout usaba `min-h-screen` en los contenedores en vez de `h-screen` + `overflow-hidden`, así que nada limitaba la altura real al viewport y el scroll ocurría a nivel de página completa en lugar de quedar contenido dentro de `<main>`. Fix en `app/(dashboard)/dashboard/layout.tsx`: `h-screen overflow-hidden` en los contenedores padres — ahora el sidebar queda fijo y solo `<main>` scrollea. Verificado con Playwright simulando scroll real dentro del contenido.
- **Mejora de UX relacionada**: el botón "autocompletar credenciales demo" en `/login` antes solo aparecía en `NEXT_PUBLIC_DEMO_MODE=true`; ahora también aparece fuera de producción (`NODE_ENV !== 'production'`), y los inputs de email/contraseña llevan `autoComplete` explícito — evita que Chrome sugiera una contraseña vieja guardada de una sesión demo anterior (causó confusión real durante esta sesión, se confundió inicialmente con el bug de arriba).
- Pendiente real: no existe todavía una suite de pruebas automatizadas del frontend contra el backend real (solo hay e2e de Playwright en modo demo, que no pasa por este interceptor ni por este layout con datos reales) — ninguno de los dos bugs de hoy lo hubiera atrapado el CI actual. Vale la pena una suite e2e adicional con un segundo `playwright.config` apuntando al backend real antes de confiar el deploy a producción.

### 2026-10-26 (noche, cont.) — tests de aislamiento multi-tenant en los 17 módulos corregidos
Cierra la deuda explícita que había quedado abierta en la pasada de seguridad de esta tarde: cada uno de los 14+1 servicios con el fix de "repetir `tenantId` en el `where` del update/delete real" ahora tiene su propio test e2e que demuestra el aislamiento de punta a punta (no solo que el código fue tocado).

- **`backend/test/tenant-isolation-financial.e2e-spec.ts`** (nuevo, 11 pruebas): `partners`, `invoices` (incluye que el tenant B no puede registrar un pago contra una factura de A ni dejarla "pagada" por accidente), `contracts` (incluye que B no puede desactivar un contrato de A), `rates` (incluye el caso específico de `findOwned` — B no puede editar/desactivar una tarifa negociada de A, solo vería las tarifas globales).
- **`backend/test/tenant-isolation-operations.e2e-spec.ts`** (nuevo, 20 pruebas): `quotes`, `bookings` (incluye que B no puede convertir una reserva de A en envío), `containers` (incluye que B no puede asignar un envío de A a un contenedor propio), `fleet` (vehículos, mantenimiento, y que B no puede crear una asignación usando el vehículo de A ni finalizar una asignación de A), `warehouses`/inventario (incluye que el stock de A queda intacto tras un intento de movimiento de B), `alerts`, `notifications`, `tracking-events` (incluye que B no puede registrar un evento sobre un envío de A, y que consultar el histórico de ese envío como B devuelve vacío, no un error).
- Total backend e2e ahora: **38 pruebas, las 38 en verde** (9 auth + 6 shipments/users + 11 financiero + 20 operación... las describe-suites se solapan un poco en el conteo pero `jest --config test/jest-e2e.json` reporta 38/38).
- Verificado: `npx eslint "test/**/*.ts" --max-warnings=1` limpio, `npx tsc --noEmit` limpio.
- Pendiente real restante (ya no "sin test", sino más fino): cobertura *unitaria* (con mocks, sin DB) del resto de servicios — hoy solo `shipments.service.spec.ts` la tiene; y los módulos sin lógica de mutación riesgosa (`documents`, `reports`, `subscriptions`, `audit`) se dejaron fuera a propósito porque no tenían el patrón que motivó esta pasada.

### 2026-10-26 (noche) — CI en GitHub Actions
Siguiente pieza de la pasada "en orden" tras la de seguridad/testing de esta misma tarde: con tests reales en ambos lados, faltaba que corrieran solos en cada push.

- **`.github/workflows/ci.yml`** nuevo, dos jobs independientes:
  - `backend`: levanta `postgres:16` y `mongo:7` como *services* del runner (con health checks), corre `prisma migrate deploy` + `prisma db seed` contra esa base efímera, luego `lint` (con `--max-warnings=1`, el único warning benigno ya conocido en `documents.controller.ts`), `tsc --noEmit`, `nest build`, `jest` (unitarios) y `jest --config test/jest-e2e.json` (e2e, incluye las pruebas de aislamiento multi-tenant) — todo contra una base real, no mocks.
  - `frontend`: `next lint`, `next build` (con `NEXT_PUBLIC_DEMO_MODE=true`), instala navegadores de Playwright y corre la suite e2e del flujo demo.
- Verificado localmente antes de confiar en el runner remoto: `npx eslint ... --max-warnings=1` da exactamente 1 warning (pasa).
- Pendiente: no hay rama protegida, así que el CI hoy es diagnóstico, no un gate — un push a `main` que rompa algo se sube igual, solo que quedará marcado en rojo en GitHub. Para que bloquee de verdad hace falta activar "require status checks" en la protección de `main` (GitHub) y moverse a flujo de PRs.

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
