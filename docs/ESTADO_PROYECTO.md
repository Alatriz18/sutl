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
- Redis/BullMQ ya existe como base (2026-11-07); faltan las tareas que corren sobre él. Sin WebSockets, sin integración real de couriers/pagos/SRI — estos módulos del backend existen como CRUDs pero sin las piezas de "Fase 2 avanzada" del plan (API keys/webhooks por tenant ya existen como UI de demo en el frontend — ver módulo Integraciones — pero no como backend real; adaptador de couriers real sigue pendiente).
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
| Control de OCs (órdenes de compra, líneas, proveedor, responsable) | **Hecho (2026-10-28)**: módulo `purchase-orders` con ciclo de vida, recepciones parciales e historial, aislado por tenant y con tests. Recepción → inventario **hecho (2026-11-03)**, configurable por empresa. Vínculo OC ↔ embarque e importación desde CSV **hechos (2026-11-06)**. |
| Inventario & cobertura (stock, consumo, safety stock, días de cobertura) | **Hecho v1 (2026-11-06)**: parámetros por SKU (consumo, stock de seguridad, lead time), días de cobertura con alerta configurable y entradas previstas desde OCs y embarques. Falta el motor de riesgo que los consume (B1). |
| Shipment tracking (hitos, ETD/ETA, BL/AWB, contenedor) | Existe: `shipments`, `tracking-events`, `containers`, `carriers`. Embarque ↔ OC **enlazado (2026-11-06)**. |
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

### 2026-11-13 (cont.) — B4: centro de excepciones con plazo y escalamiento (escrito SIN ejecutar el stack)

Verificado: `tsc`, lint y **257 pruebas unitarias** del backend (18 nuevas). **Sin correr:** `backend/test/exceptions.e2e-spec.ts`, el caso de Playwright y la migración `20261113130000_centro_excepciones` (a mano).

- **Qué detecta (v1):** SKU en rojo (grave) y OC vigente con fecha requerida vencida (moderada; grave si pasa de 7 días). Una excepción por (tipo, clave): si el problema desaparece se **resuelve sola** y si vuelve se **reabre la misma**, sin duplicar.
- **SLA configurable por empresa** (`excepciones` en la configuración de la operación, con perfil + ajustes, validado en el backend): `slaAltaHoras` (24), `slaMediaHoras` (72) y `crearTareas` (sí). Con el plazo vencido y el problema vigente, escala **una sola vez** a «crítica» y manda **un correo por administrador** con todas las vencidas de la ronda. Todo cambio condicional al estado leído: dos evaluaciones simultáneas no duplican casos ni avisos.
- Cada excepción nueva abre una **tarea** (B3) con la fecha límite del plazo, sin responsable (la crea el primer administrador activo; el sistema no es un usuario) y todo queda en la **bitácora** (`excepcion.abierta/resuelta/escalada`).
- Ronda programada en su propia cola `excepciones` cada `EXCEPCIONES_EVAL_CADA_MIN` (30) minutos; `POST /exceptions/evaluar` para evaluar al momento y `GET /exceptions?estado=`.
- Frontend: pantalla **Excepciones** (severidad con texto, plazo restante/vencido, «Evaluar ahora», mostrar resueltas), tarjeta «Excepciones y plazos» en Configuración y demo equivalente.
- **Pendiente:** reglas de documento faltante (cuando exista C1), responsable por regla, y que el aviso de escalada también salga por WhatsApp si la empresa lo elige.

### 2026-11-13 — B3: tareas, comentarios y bitácora (escrito SIN ejecutar el stack)

**Qué hay.** Mismo acuerdo que el 12 nov (Docker apagado): código verificado con `tsc`, lint y **244 pruebas unitarias** del backend en verde; las e2e y de navegador nuevas están escritas pero **sin correr**, y la migración `20261113120000_tareas_comentarios` está escrita a mano (verificar con `prisma migrate diff --from-migrations … --shadow-database-url …`).

- Modelos `Task` y `TaskComment` (estados abierta / en_curso / hecha / cancelada; prioridad baja / media / alta; responsable, fecha límite y vínculo opcional a `orden_compra`, `envio` o `sku`). Las tareas **no se borran**: se cancelan, para que la bitácora siga siendo cierta.
- Reglas (backend): el responsable debe ser personal activo de la **misma empresa** y no un cliente final; la OC o el envío referido debe ser de la empresa (404 igual que si no existiera); un operador solo modifica tareas que creó o le asignaron (el administrador, todas); una tarea cancelada no se edita hasta reabrirla; el cambio es condicional en la versión leída (dos ediciones a la vez → 409, no se pisan); marcar «hecha» guarda cuándo, reabrir lo borra.
- **Bitácora** (`AuditService`, global, sobre la tabla `audit_logs` que ya existía y nadie usaba): solo se agrega, guarda actor, acción, entidad y los cambios con valor anterior y nuevo; registrar nunca rompe la operación. `GET /api/audit` solo para el administrador de la empresa. Otros módulos pueden empezar a registrar con `AuditService.registrar` (base para C2).
- API: `GET/POST /tasks`, `GET/PATCH /tasks/:id`, `POST /tasks/:id/comments` (no disponible para `cliente_final`).
- Frontend: pantalla **Tareas** (pendientes / hechas / canceladas, «solo las mías», vencidas marcadas con texto, detalle con comentarios y bitácora) y su equivalente en modo demo.
- Pruebas: 23 unitarias nuevas (tareas y bitácora), `backend/test/tasks.e2e-spec.ts` (aislamiento entre empresas, permisos, cancelada, bitácora) y un caso en `frontend/e2e/golden-path.spec.ts`.
- **Pendiente de B3:** evidencia adjunta, aviso al responsable cuando se le asigna (usar notificaciones) y que B4 cree tareas automáticamente desde las excepciones.

### 2026-11-12 — Código para cerrar A10, B1b y A4 (escrito SIN ejecutar el stack: Docker apagado a pedido de Kevin)

**Qué hay y qué falta verificar.** Por pedido de Kevin (la PC iba justa de recursos) esta tanda se escribió solo con código; se verificó con `tsc`, lint y pruebas **unitarias** (215+ en verde, sin base de datos). **Faltan por correr con Docker:** las pruebas e2e del backend y de navegador nuevas, y las dos migraciones escritas a mano (verificar con `prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url …` que no haya diferencias; la de API keys/webhooks sí se generó contra la base).

**A10 — API pública v1 y webhooks por empresa**
- `ApiKey`: formato `sutl_` + 32 caracteres aleatorios; en la base solo la huella SHA-256 y un prefijo; se muestra completa una sola vez; máximo 20 activas; revocable. `ApiKeyGuard` (cabecera `X-API-Key`): todo fallo responde «API key inválida» (no revela si existió, se revocó o la empresa está inactiva); marca el último uso como mucho una vez por minuto.
- API pública solo lectura (`/api/v1/shipments`, `shipments/:codigoGuia` con eventos de tracking, `purchase-orders`, `supply-risk`), 300 peticiones/min, paginada (límite 200), con un contrato propio que no expone IDs internos ni `tenantId`; la llave no sirve en la API del panel y un JWT no sirve en la v1.
- Webhooks: URL validada contra **SSRF** (https obligatorio; rechaza localhost, redes privadas, enlace local y metadatos de la nube, también al momento de cada entrega por si el DNS cambia; sin redirecciones; sin usuario/contraseña en la URL); firma `X-SUTL-Signature: t=…,v1=HMAC-SHA256(secreto, t.cuerpo)` con tolerancia anti-replay; secreto `whsec_…` mostrado una vez y **cifrado en reposo con AES-256-GCM** (`ENCRYPTION_KEY`, obligatoria en producción: sin ella la app no arranca); cola con 5 intentos (10 s, 20 s, 40 s…), historial de las últimas entregas, botón «Probar», activar/desactivar, máximo 10 por empresa.
- Eventos (contrato estable): `envio.creado`, `envio.estado_cambiado`, `orden_compra.estado_cambiado`, `riesgo.semaforo_cambiado`. Se publican desde envíos, OCs (transición, recepción y despacho automático al vincular) y el monitor de riesgo; publicar nunca rompe la operación de negocio.
- Pantalla de Integraciones: claves y webhooks reales (secretos de un solo uso con copiar, confirmación al revocar/eliminar, historial de entregas). El catálogo de conectores de terceros sigue siendo solo demo y en modo real se explica.
- `WEBHOOKS_ALLOW_PRIVATE=true` (solo desarrollo/pruebas) permite http y direcciones locales; se ignora en producción.

**B1b — Monitor de riesgo**
- Cola `riesgo` con ronda cada `RISK_EVAL_CADA_MIN` minutos (60 por defecto) sobre las empresas activas con SKU; una que falla no frena a las demás.
- `RiskState` (último semáforo por SKU) y `RiskChange` (historial). El cambio es **condicional en el semáforo anterior** (y la primera inserción usa unique): dos evaluaciones simultáneas no duplican historial ni avisos.
- Un solo correo por ronda a los `admin_tenant` activos con todos los SKU que pasaron a rojo; configurable por empresa (`riesgo.avisarAlPasarARojo`, activo por defecto, en Configuración). `POST /supply-risk/evaluar` y `GET /supply-risk/cambios`; la pantalla de Riesgo muestra «Evaluar ahora» e historial.

**A4 — Contacto de la landing**
- Sección «Agenda tu diagnóstico» con formulario (nombre, empresa, correo, teléfono y mensaje opcionales), campo trampa para bots, una solicitud por correo al día, 5 por hora por IP (`LEADS_RATE_LIMIT`), respuesta idéntica en todos los casos. El contacto se guarda (`Lead`) y avisa a `CONTACT_INBOX_EMAIL`; si el correo falla no se pierde. `GET /api/leads` solo para super_admin. **Pendiente de Kevin:** definir `CONTACT_INBOX_EMAIL` real y si quiere además un botón de WhatsApp.

**Unitarias nuevas (A9):** cifrado y SSRF (44), firma de webhooks, API keys y su guard, notificaciones, servicio de webhooks, monitor de riesgo y leads. Cobertura solo de pruebas unitarias: 27 %; la meta ≥ 70 % se medirá sumando las e2e cuando se pueda correr Docker (`jest --config test/jest-e2e.json --coverage`).

### 2026-11-10 (cont.) — Notificaciones reales: correo y WhatsApp (A11)

- **El envío ya no es simulado.** Crear una notificación valida el destino, la guarda como pendiente y la encola (cola `notificaciones` de BullMQ, 3 intentos con espera creciente); la API no espera al proveedor. Sin Redis se envía en el momento. Un trabajo repetido no duplica el envío (si ya está enviada, no hace nada).
- **Correo por SMTP** (`nodemailer`): sirve con SES, SendGrid, Mailgun o Google Workspace. En desarrollo apunta a **Mailpit** (Docker Compose, bandeja en http://localhost:8025): el correo sale de verdad pero no llega a nadie. Variables `SMTP_HOST/PORT/SECURE/USER/PASS/FROM`.
- **WhatsApp Cloud API** (Meta) por `fetch`: variables `WHATSAPP_TOKEN` y `WHATSAPP_PHONE_ID`. Sin ellas el canal queda deshabilitado y la pantalla lo dice. **Limitación de Meta:** el texto libre solo llega si la persona escribió en las últimas 24 h; para iniciar conversación hacen falta plantillas aprobadas (siguiente paso, dependen de la cuenta de Meta del cliente). Probado contra un simulador local de la API, **no contra Meta real** (no hay credenciales).
- **Reglas:** push y SMS se rechazan con un mensaje claro (no tienen proveedor). Un error definitivo (destino inválido, 4xx del proveedor salvo 429) no se reintenta; un 5xx o un corte sí. Los mensajes de error que se guardan y se muestran van recortados y sin tokens. Correo: validación estricta del destino (un solo correo) y asunto sin saltos de línea (sin inyección de cabeceras). Teléfono en formato internacional E.164.
- **Reenvío:** `POST /notifications/:id/reenviar` para las fallidas (atómico: dos clics no encolan dos envíos). Se eliminó `marcar-enviada`, que era la simulación. `GET /notifications/canales` informa qué canales están conectados. Las rutas son de admin_tenant, operador y super_admin (el cliente_final ya no puede enviar mensajes).
- **Esquema:** migración `20261110120000_notificaciones_reales` (canal `whatsapp`, `destino`, `intentos`, `error`).
- **Defecto de pruebas encontrado y corregido:** las suites e2e compartían la misma cola de Redis y la app de otra suite procesaba los trabajos con SU configuración. Ahora cada worker de Jest usa su propio prefijo de cola.
- Pantalla de Notificaciones rehecha: canal (correo/WhatsApp), destino, error visible, intentos, botón Reenviar y consulta automática mientras haya pendientes. En el modo demo se da por enviada al instante (no envía nada).
- Verificado: 15 pruebas e2e de backend (correo real hacia Mailpit, WhatsApp contra el simulador con reintentos, 4xx definitivo, token sin filtrar, inyección de cabeceras, aislamiento, 401), 21 unitarias de validación y redacción, 1 de navegador en demo y 1 contra el backend real que comprueba que el correo llegó a Mailpit. CI: Mailpit agregado como servicio.
- **Pendiente:** ajuste por empresa de qué canales usa (hoy los canales son de todo el servidor); credenciales y plantillas de WhatsApp de un cliente real; push/SMS.

### 2026-11-10 — Motor de riesgo de abastecimiento v1 (B1)

- **Motor puro** (`backend/src/modules/supply-risk/risk-engine.ts`, sin base de datos ni reloj propio): con el stock y el consumo diario proyecta cuándo se acaba cada SKU y suma, en su día, las reposiciones con fecha (embarques en camino con su ETA). Devuelve semáforo, primer día de quiebre, **días sin stock** antes de que llegue la reposición, hasta cuándo alcanza todo, fecha en que baja del stock de seguridad y una **acción recomendada**.
- **Reglas:** rojo si el stock llega a cero antes de la reposición, ya no hay stock, o no hay nada en camino y el lead time del proveedor no alcanza; amarillo si baja del stock de seguridad, la cobertura total queda bajo el umbral de la empresa (`inventario.diasCoberturaAlerta`) o una ETA ya venció sin recibirse; verde si no; sin datos si falta consumo, stock o política.
- **Acciones:** urgir al proveedor (hay OC sin despachar), partir el embarque (hay uno en camino que llega tarde), compra urgente (nada en camino), confirmar la fecha real, planificar la compra.
- **Criterios conservadores (documentados en la pantalla):** una OC que todavía no viaja no cuenta como llegada (no hay fecha confiable) y una ETA vencida tampoco se cuenta.
- API `GET /api/supply-risk` (admin_tenant, operador, super_admin; filtrada por empresa) y pantalla **Riesgo de abastecimiento** en la web (tarjetas por semáforo, filtros, motivo, acción y lo que viene; el color nunca va solo, siempre con texto). El modo demo usa una copia del motor (`frontend/src/lib/mock/risk-engine.ts`).
- **Defecto encontrado en la primera revisión de la pantalla:** el tramo posterior a la última reposición marcaba siempre «bajará del stock de seguridad» aunque hubiera cobertura de sobra. Corregido, con 2 pruebas de regresión.
- Verificado: 21 pruebas unitarias del motor, 8 e2e contra Postgres (rojo con días sin stock y OC sin despachar, compra urgente, verde, sin datos, orden, aislamiento entre empresas, 401), 1 de navegador en demo, 1 contra el backend real y la auditoría de accesibilidad con la pantalla nueva.
- **Pendiente (B1b):** evaluación periódica con la cola, historial de cambios de semáforo y aviso al pasar a rojo; reglas configurables por empresa; fechas de llegada para OCs sin embarque.

### 2026-11-07 (cont. 3) — Dependencias vulnerables: lo que se pudo arreglar sin cambiar el stack (parte de A9)

- **Backend:** `bcrypt` 5 → 6 (API compatible; verificado hash/compare y los 159 e2e). Quita la vulnerabilidad **crítica** (`tar`, que llegaba por `node-pre-gyp` de bcrypt). `npm audit fix` sin `--force` no cambió más. De 1 crítica + 12 altas + 17 moderadas (con dev) quedan en producción **7 altas y 5 moderadas**.
- **Frontend:** `npm audit fix` actualizó axios, follow-redirects, nanoid y source-map-js. Quedan 2 en producción: `next` (la crítica; DoS por Image Optimizer / Server Components y request smuggling en rewrites) y `postcss`, que solo se corrigen subiendo **Next 14 → 16**.
- **Decisión pendiente de Kevin:** subir NestJS 10 → 12 en el backend (arregla las 12 restantes; hay que revisar `@nestjs/bullmq`, que hoy va en la 11 por ser la 12 solo ESM) y Next 14 → 16 en el frontend. Ambas cambian el stack fijado en CLAUDE.md, por eso no las hice. Mitigación mientras tanto: el despliegue es solo local, así que la exposición actual es baja; **deben resolverse antes del staging (D1)**.
- Verificado: tsc, lint, build, 38 unitarias + 159 e2e del backend y 13 unitarias del frontend, todo en verde.

### 2026-11-07 (cont. 2) — Importación desde Excel (.xlsx) (A12)

- El asistente de importación (OCs y parámetros por SKU) acepta **.xlsx** además de CSV, con `read-excel-file` 9 (carga diferida: solo se descarga al elegir un Excel). Lee la primera hoja; la fila 1 son los encabezados.
- **Celdas tipadas, sin ambigüedad:** un número real de Excel nunca se reinterpreta (1,234 no se lee como 1234 por el criterio de miles del CSV: `celdaATexto` lo normaliza), las fechas llegan como fecha, las filas totalmente vacías se descartan y los errores reportan la **línea real de la hoja**.
- **Límites:** 2 MB por .xlsx (es un zip; se limita más que el CSV para acotar archivos que se expanden mucho al abrirse), 5.000 filas. Un **.xls antiguo se rechaza** con instrucciones y un .xlsx dañado o con contraseña muestra un error claro.
- Verificado: 3 pruebas unitarias nuevas (13 en total) y 2 de navegador nuevas con un .xlsx real generado con tipos de celda reales (número, fecha, fila vacía, cantidad inválida en la línea 6) y con un archivo dañado. `npm audit` no marca la librería nueva.
- **Pendiente de seguridad (A9):** `npm audit --omit=dev` del frontend lista 6 vulnerabilidades ya existentes (1 crítica en `next` y 5 altas en axios, follow-redirects, nanoid, postcss y source-map-js); no vienen de este cambio. Requieren subir versiones y se atacan en A9.

### 2026-11-07 (cont.) — Accesibilidad, e2e contra el backend real y límites de login configurables (A8)

- **Auditoría de accesibilidad con axe-core** (`frontend/e2e/accesibilidad.spec.ts`): 29 pantallas (landing, login y todo el panel, incluidos los formularios de alta y los detalles) con las reglas WCAG 2.0/2.1 A y AA. Encontró y se corrigieron: 25 `select`/`input` sin nombre accesible (ahora con `aria-label` o con `<label htmlFor>`), el interruptor de alertas sin nombre, 12 etiquetas que no estaban asociadas a su campo y un gráfico de pastel con sectores sin nombre (se oculta el SVG y se ofrece el mismo dato como texto para lectores de pantalla). Resultado: 0 violaciones. **Fuera de este corte: contraste de color** (se revisa aparte con el diseño de marca).
- **Suite e2e contra el backend real** (`frontend/e2e-real/`, `npm run test:e2e:real`, config `playwright.real.config.ts`): 9 flujos con JWT y servidor reales — login válido e inválido, redirección sin sesión, crear envío → detalle → tracking público, crear y emitir OC, cobertura de inventario, **aislamiento entre empresas en el navegador** (otra empresa no ve los envíos de la demo) y visibilidad de secciones por rol (con control positivo). Falla rápido con un mensaje claro si el backend no está arriba o la base no está sembrada. **Pendiente:** correrla en el CI (necesita levantar backend + semilla + navegadores en el job).
- **Límites de peticiones configurables por entorno** (`backend/src/common/rate-limit.ts`): `LOGIN_RATE_LIMIT` (defecto 5/min) y `RATE_LIMIT` (defecto 120/min). Un valor inválido usa el defecto y **en producción solo pueden endurecerse, nunca subir**. Hizo falta porque la suite de navegador hace más de 5 logins por minuto. Probado: 5 pruebas unitarias del parseo y una e2e que verifica el 429 al exceder el límite. En el `.env` local quedaron holgados (200 y 2000); el `.env.example` documenta los defaults.
- **Hallazgo de proceso:** `next dev` en modo real ocupaba el puerto 3002 y Playwright lo reutilizó, así que la primera corrida de la auditoría se hizo en el modo equivocado y dio fallos falsos de login; ya está anotado en la memoria de trampas del entorno.
- Verificado: backend 38 unitarias + 159 e2e; frontend 10 unitarias + 41 Playwright en modo demo + 9 contra el backend real; tsc y lint limpios. El cronograma (PDF) marca A7 y A8 como hechas.

### 2026-11-07 — Redis + BullMQ: base de colas de trabajo (A7)

- **Redis 7** en Docker Compose (puerto local 6380, persistencia `appendonly`) y como servicio en el CI. Variable `REDIS_URL` en `backend/.env.example`; sin ella las colas quedan deshabilitadas y la API sigue funcionando (aviso en el log).
- Módulo `queues` (`@nestjs/bullmq` 11 + `bullmq` 6; la 12 de `@nestjs/bullmq` es solo ESM y no corre en este backend CommonJS): cola `mantenimiento` con reintentos con backoff exponencial, un trabajo programado «latido» cada minuto (idempotente al arrancar) y procesador que falla —no descarta— los trabajos desconocidos.
- `QueuesService.encolar()` exige `tenantId`: todo trabajo de negocio debe declarar su empresa y su procesador filtrar por ella. Sobre esta base van el motor de reglas de riesgo (B1), las notificaciones (A11) y los webhooks (A10).
- `GET /api/queues/estado`: solo `super_admin` (403 para admin de empresa, 401 sin token).
- Las pruebas usan otro prefijo de Redis (`sutl-test`): vaciar su cola no borra el programador del entorno de desarrollo (error que me pasó en la primera corrida).
- Verificado: 7 pruebas nuevas (158 e2e en total, verdes) y el latido corriendo solo en el backend real.

### 2026-11-06 — Vínculo OC ↔ embarque, cobertura de inventario, importación CSV, ADRs y proceso de PR
Tareas del cronograma A1, A3, A5 (CSV) y A6 cerradas en la semana 5, adelantadas respecto del plan; A2 queda a falta de un paso en GitHub.

**Vínculo OC ↔ embarque (A1)**
- Modelo `ShipmentPurchaseOrderLine`: cantidad de cada línea de OC que viaja en cada embarque. Una línea se reparte en varios embarques y un embarque trae líneas de varias OCs. Un solo registro por par embarque + línea.
- API: `POST /purchase-orders/:id/embarques` (cantidad 0 quita la línea) y `DELETE /purchase-orders/:id/embarques/:shipmentId`. El detalle del envío lista la carga de OCs que trae.
- Reglas:
  - Solo OCs emitida, confirmada, despachada o recibida parcial.
  - El embarque no puede estar entregado y debe ser del tenant (404 si no).
  - La suma asignada de una línea no puede superar lo pedido más la tolerancia de la empresa.
  - Las filas de la línea se bloquean (`FOR UPDATE`), así que dos asignaciones simultáneas no sobrepasan lo pedido; lo cubre una prueba de concurrencia.
- Ajuste configurable nuevo `compras.vincularEmbarqueDespachaOc`: al vincular un embarque a una OC confirmada la marca como despachada. Por perfil: manufactura y comercio sí; general y ERP propio no.
- Web:
  - La OC muestra la columna «En camino» y la tarjeta «Embarques», con el formulario para vincular o quitar carga.
  - La alerta de fecha ahora usa la **ETA real** del embarque, que pesa más que la promesa del proveedor.
  - El detalle del envío muestra las OCs que viajan en él.

**Cobertura de inventario (A6)**
- Modelo `InventoryPolicy` por SKU: consumo diario, stock de seguridad, lead time y existencias externas.
- API: `GET /inventory-coverage`, `GET|PUT /inventory-policies`, `DELETE /inventory-policies/:id` e `importar`.
- Cada fila trae stock, días de cobertura, bajo seguridad, bajo umbral, lo pendiente de OCs vivas, lo que ya viaja y la próxima ETA. Es el insumo del motor de riesgo (B1).
- Ajuste configurable nuevo `inventario.diasCoberturaAlerta`: umbral de alerta, 15 días en general, 30 en manufactura, 20 en comercio.
- **Empresas con inventario en su ERP (modo «nunca»)**: el stock sale de las existencias que reportan por SKU (a mano o por CSV), no de Almacén; en los otros modos esas existencias se rechazan.
- Pantalla nueva `/dashboard/cobertura` (Supply Control), con filtros, búsqueda y edición de parámetros.

**Importación desde CSV (A5)**
- `POST /purchase-orders/importar` y `POST /inventory-policies/importar`.
  - Cada fila se valida con las mismas reglas que la API normal y los errores se informan fila por fila.
  - `simular` valida sin guardar.
  - Las filas con el mismo N° de OC forman una OC; una OC con una fila inválida no se importa a medias.
  - Las OCs que ya existen se omiten, así que la carga es repetible.
  - Proveedor por RUC o nombre, solo del propio tenant; opción de crear los que no existan, y solo si su OC se importa.
- `ImportMapping`: el mapeo de columnas se guarda **por empresa** (`GET|PUT /import-mappings/:tipo`), sanitizado.
- Asistente en la web: detecta el separador (Excel en español usa «;») y la codificación (UTF-8 o Windows-1252), sugiere columnas por nombre, interpreta números como 1.234,56 y fechas como 15/12/2026, muestra una vista previa, valida y luego importa. Pantallas `/dashboard/compras/importar` y `/dashboard/cobertura/importar`.
- **Limitación conocida**: lee CSV, no `.xlsx` directo (en Excel: Guardar como → CSV). Queda como tarea A12. Un número con un separador y exactamente tres dígitos detrás, como «1.234», se lee como 1234 (lo habitual en la región); la vista previa muestra cómo se interpretó.

**Defectos corregidos al probar las importaciones**
- Un lote de miles de filas devolvía **500**: Express limita el cuerpo JSON a 100 KB y el filtro global convertía ese error en un 500 genérico. Ahora solo las dos rutas de importación aceptan hasta 5 MB (`common/body-limits.ts`) y el resto de la API conserva su límite.
- El filtro global de excepciones (`http-exception.filter.ts`) respeta los 4xx del parser (413 cuerpo demasiado grande, 400 JSON mal formado) en vez de dar 500, y **registra en el log los errores inesperados**, que antes se perdían en silencio.
- Trampa de Nest: para decidir si ya hay un parser JSON mira el *nombre* de la función del middleware. Montar el de Express directo (se llama `jsonParser`) hacía que Nest no registrara el global y toda la API dejara de leer el cuerpo. Se envuelve en una función anónima; está comentado en el código.
- En la pantalla de cobertura el texto `sr-only` de la tabla estiraba toda la página en celular (427 px de desborde): el contenedor con scroll ahora es `relative`.

**Proceso y documentación (A2 parcial, A3)**
- ADRs en `docs/adr/`: 001 multi-tenancy por fila (con las reglas obligatorias de aislamiento), 002 Postgres + Mongo y 003 configuración por empresa.
- `.github/pull_request_template.md` con la Definición de Hecho, `.github/CODEOWNERS`, `docs/CONTRIBUTING.md` y badge de CI en el README. El CI ahora corre también en `develop` y ejecuta las pruebas unitarias del frontend (`npm run test:unit`).
- **Falta (solo el dueño del repo)**: activar la protección de `main` y `develop` en GitHub y crear `develop`; los pasos están en `docs/CONTRIBUTING.md`. `gh` no tiene sesión en esta máquina y no se puede hacer desde aquí.

**Seed**: 3 embarques (SUTL-DEMO-0011 a 0013) con sus vínculos, existencias en la bodega demo y 6 parámetros por SKU, de modo que la demo muestra la alerta por ETA real y varios SKUs bajo el umbral. Idempotente; verificado corriéndolo dos veces. Migraciones `20261106120000_vinculo_embarques_politicas_importacion` y `20261106130000_existencias_externas_politicas`. Modo demo del frontend al día con las mismas reglas (`src/lib/mock/supply.ts`).

**Tests**
- Backend: 28 unitarias y 151 e2e, todas en verde. Nuevas: `purchase-order-shipments` (17, incluida concurrencia), `inventory-coverage` (18), `purchase-orders-import` (17, incluidos los mapeos).
- Frontend: 10 unitarias del lector de CSV y de la normalización de números y fechas (`npm run test:unit`) y 12 de navegador con Playwright, con 3 flujos nuevos.
- Lint, `tsc` y builds limpios. Verificado además en navegador contra el backend real, en escritorio y celular, sin desborde horizontal.
- No verifiqué que las pruebas de concurrencia de las asignaciones fallen si se quita el bloqueo (sí lo hice con la de inventario del 3 de nov).

**Re-planificación**: al ir adelantados, la Fase A se cierra en la semana 9 y la Fase B se adelanta 2 semanas (motor de riesgo desde la semana 8). Los hitos del Plan Maestro no se mueven: quedan con colchón. Detalle en `docs/Cronograma_SUTL.pdf`. El PDF pasó a 10 páginas: la nueva segunda página resume la semana 5 y detalla el plan de la semana 6 (9–13 nov); también se adelantaron C1, C2, C5 y C7 para repartir la carga (ninguna semana pasa de 6 tareas en paralelo) y se agregó A12 (leer .xlsx directo).

### 2026-11-04 — Cronograma y hoja de ruta (PDF)
Pedido de Kevin: un cronograma tipo proyecto con lo que ya existe, lo que falta, tareas y semanas.

- **`docs/Cronograma_SUTL.pdf`** (9 páginas, A4 apaisado): resumen con mapa de cobertura del Business Plan e hitos, lo que ya funciona y lo que no existe, Gantt por semanas (semana 1 = 5 oct 2026, hasta la salida a producción en la semana 25 = 22 mar 2027), detalle de 37 tareas con responsable y dependencias, riesgos, decisiones pendientes y horizonte posterior al go-live.
- **Fases**: A (MVP operable de abastecimiento, hasta el 11 dic), B (Control Tower: riesgo, excepciones y trabajo humano, hasta el 22 ene), C (portal colaborativo, analítica y panel SaaS, hasta el 19 feb), D (nube, seguridad y salida, en paralelo) y E (comercial y piloto con design partners, en paralelo). Las fechas de hitos son las del Plan Maestro v1.0; el contenido se ajustó al giro del Business Plan 2026.
- **Ruta crítica**: decidir dónde vive el staging (D1, antes de la Sem 6) → staging en línea (D2) → piloto con un cliente real (E3). Hoy el único entorno activo es local.
- **Para actualizarlo**: editar `docs/cronograma/data.js` (tareas, semanas, estados) y correr `node docs/cronograma/build.js`; usa el Chromium de Playwright del frontend.
- Las estimaciones son propuestas mías (±1 semana, equipo de dos personas con Claude Code), no compromisos; las semanas de lo ya hecho son aproximadas.

### 2026-11-03 — Configuración de la operación por empresa + recepción de OC → inventario
Pedido de Kevin: cada industria trabaja distinto (unas quieren que la recepción mueva inventario y otras no, algunas llevan el stock en su ERP), así que las reglas que varían entre clientes deben ser **configurables por empresa** en vez de estar fijas en el código.

**Modelo** (`backend/src/modules/tenant-config`):
- **Perfil de industria con valores sugeridos**: `general`, `manufactura`, `comercio`, `erp_externo` (inventario en ERP propio).
- **Ajustes propios del tenant** encima del perfil. Se guardan solo las diferencias, en `Tenant.configuracion` (JSON) + `Tenant.perfilOperacion`.
- Un ajuste nuevo que se agregue a futuro toma el valor del perfil sin migrar datos.
- El JSON guardado se lee de forma defensiva: se descartan claves desconocidas y tipos incorrectos.

**Ajustes de esta primera versión** (todos se aplican de verdad; ninguno es solo visual):
- `compras.toleranciaSobreRecepcionPct` (0–50%): cuánto más de lo pedido se acepta recibir por línea. Se aplica en el incremento atómico de la recepción.
- `compras.diasAlertaAnticipada` (1–90): umbral de la alerta ámbar de OCs sin confirmar, en la lista y en el detalle.
- `compras.exigirFechaConfirmacion`: si confirmar una OC exige la fecha comprometida por el proveedor.
- `inventario.recepcionActualizaInventario`:
  - `automatico`: toda recepción entra a una bodega, que es obligatoria.
  - `a_eleccion`: quien recibe decide.
  - `nunca`: el inventario vive en otro sistema.
  - Pedidos contradictorios con la configuración se rechazan con 400; no se ignoran en silencio.

**API**:
- `GET /tenant-config` (admin_tenant, operador, super_admin).
- `PATCH /tenant-config` (solo admin_tenant/super_admin):
  - `perfil` aplica el perfil y descarta los ajustes.
  - `restablecer` + `configuracion` reemplaza los ajustes de forma atómica.
  - Validación estricta con DTO anidado y `forbidNonWhitelisted`.
- Siempre actúa sobre el tenant del JWT; nunca por parámetro.

**Recepción de OC → inventario** (`purchase-orders.service.ts`), en la misma transacción que la recepción:
- Suma al ítem del SKU en la bodega, o lo crea si no existe, y registra el `StockMovement` de entrada con nota "Recepción OC <número>".
- `PurchaseOrderReceipt.warehouseId` guarda a qué bodega entró; es null si no movió stock.
- La bodega debe ser activa y del tenant (404 si no).
- Si la unidad del SKU en inventario no coincide con la de la OC, responde 400 y la transacción se revierte entera.
- Dos recepciones simultáneas del mismo SKU nuevo no crean ítems duplicados: lock `pg_advisory_xact_lock` por tenant+bodega+SKU. Lo cubre una prueba e2e de concurrencia.

**Inventario con decimales**: `InventoryItem.cantidad` y `StockMovement.cantidad` pasan de `Int` a `Float`, para kg, m³ y litros de materia prima. Los DTOs de almacén aceptan hasta 4 decimales.

Migración `20261028150000_configuracion_operacion`.

**Frontend**:
- Nueva pantalla **Administración → Configuración de la operación** (`/dashboard/configuracion`):
  - Tarjetas de perfil con confirmación antes de aplicar.
  - Campos con la etiqueta "Ajustado · sugerido: X" cuando difieren del perfil.
  - Botón "Volver a los valores del perfil".
  - El operador la ve en solo lectura.
- El detalle de OC se adapta a la configuración:
  - Casilla "Ingresar lo recibido al inventario" en `a_eleccion`.
  - Selector de bodega, con preselección si hay una sola.
  - Aviso de que no se mueve stock en `nunca`.
  - Máximo por línea con la tolerancia aplicada.
  - Fecha de confirmación opcional cuando la empresa no la exige.
  - El historial muestra la bodega de cada recepción.
- Modo demo: mismas reglas en `src/lib/mock/tenant-config.ts` y `adapter.ts`.
- Corregido en Almacén (bug previo):
  - La unidad se pluralizaba pegando una "s" ("unidads", "kgs").
  - El campo de cantidad no aceptaba decimales.

**Tests**:
- Backend:
  - 28 unitarias (nuevas: `tenant-config.defaults.spec.ts` y 5 casos de OC según la configuración).
  - 99 e2e. Nuevo `test/tenant-config.e2e-spec.ts` con 17 casos: perfiles, ajustes, validación, roles, aislamiento entre tenants y cada modo de recepción contra Postgres real, incluida la concurrencia.
- Frontend:
  - Playwright 9/9. Nuevo flujo: aplicar Manufactura → ajuste propio → recibir OC → ver el SKU en Almacén.
  - tsc, lint y build limpios.
  - Verificado en navegador en modo real, escritorio y móvil, sin desborde horizontal.

**Pendiente**: vínculo OC ↔ envío (qué cantidad de cada línea viaja en cada embarque). La configuración está pensada para crecer: nuevos ajustes se agregan en `tenant-config.defaults.ts` + DTO + pantalla.

### 2026-10-28 (cont. 2) — Aislamiento multi-tenant en las referencias (fuga corregida)
Kevin definió que por ahora se trabaja **solo en local** (el deploy en línea no está disponible).

**Seguridad — fuga entre tenants corregida (existía desde antes)**: los `create`/`update` aceptaban IDs de otros registros en el body sin validar que fueran del mismo tenant. Prisma solo valida que el ID exista (FK), así que el tenant B podía enlazar sus registros a datos del tenant A y, como las respuestas usan `include`, **leer esos datos** (nombre, RUC, email del cliente, etc.). Requería conocer el UUID (no adivinable), pero rompía el aislamiento. Se confirmaron 14 vías con una prueba que **falló sin el fix** (16 de 18):
- `quotes` (create/update): `clienteId`.
- `bookings` (create/update): `clienteId`, `quoteId`.
- `invoices`: `partnerId`, `shipmentId`.
- `alerts` (create/update): `shipmentId`.
- `fleet` (asignaciones): `driverId`, `shipmentId`.
- `notifications`: `userId` (exponía el email del usuario de A).
- `warehouses` (ítems): `ubicacionId` — además debe ser de **la misma bodega** (las ubicaciones no tienen `tenantId` propio), y `shipmentId`.

Fix: helper común `backend/src/common/tenant-refs.ts` (`assertTenantRefs`), usado en los 11 servicios afectados. Responde 404 con el mismo mensaje que un ID inexistente (no revela si existe en otro tenant). `carrierId` es catálogo global (sin tenant): solo se valida que exista, así un ID inválido da 404 en vez de un 500 por FK (`shipments`, `bookings`, `quotes`, `containers`, `contracts`, `rates`).

Test nuevo `backend/test/tenant-isolation-references.e2e-spec.ts` (18 pruebas: cada vía rechazada, la respuesta no filtra datos de A, las referencias propias siguen funcionando, los registros de B quedan intactos). Totales: backend 18 unitarias + 82 e2e en verde; lint/tsc/build limpios. Frontend sin cambios (sus formularios solo ofrecen registros del propio tenant).

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

**Pendiente detectado** (referencias entre tenants en `bookings`/`invoices`/`quotes` y otros) — **corregido** el mismo día, ver la entrada siguiente.

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
