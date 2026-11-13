// Datos del cronograma SUTL. Semana 1 = lunes 5 oct 2026 (Sprint 1 del Plan Maestro v1.0).
// Estados: hecho | siguiente | pendiente. decision:true = depende de una decisión de Kevin.

const TOTAL_WEEKS = 25; // semana 25 = salida a producción (22 mar 2027)
const TODAY_WEEK = 5; // corte: viernes 6 nov 2026, fin de la semana 5
const NEXT_WEEK = 6; // plan: 9–13 nov

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const weekStart = (n) => new Date(Date.UTC(2026, 9, 5 + 7 * (n - 1)));
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
const fmt = (d) => `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`;
const semanas = (s, e) => (s === e ? `Sem ${s}` : `Sem ${s}–${e}`);
const fechas = (s, e) => `${fmt(weekStart(s))} – ${fmt(addDays(weekStart(e), 4))}`;

const MONTHS_HEADER = [
  ['Oct', 4], ['Nov', 5], ['Dic', 4], ['Ene 2027', 4], ['Feb', 4], ['Mar', 4],
];

const MILESTONES = [
  { w: 4, code: 'H1', date: '30 oct', done: true, text: 'Base técnica: backend real, CI y seguridad (en local).' },
  { w: 10, code: 'H2', date: '11 dic', text: 'MVP operable de abastecimiento: OC ↔ embarque ↔ inventario con cobertura, importación desde ERP, API v1 y notificaciones.' },
  { w: 11, code: 'ST', date: '18 dic', text: 'Staging en línea: un design partner ya puede usar SUTL.' },
  { w: 16, code: 'H3', date: '22 ene', text: 'Control Tower operable: riesgo de abastecimiento, excepciones, tareas y roles de analista y proveedor.' },
  { w: 20, code: 'H4', date: '19 feb', text: 'Portal colaborativo, analítica y planes con pasarela de pago.' },
  { w: 24, code: 'H5', date: '19 mar', text: 'Cierre de desarrollo, UAT y pruebas de seguridad terminadas.' },
  { w: 25, code: 'GL', date: '22 mar', text: 'Salida a producción (semana del 22 de marzo de 2027).' },
];

const PHASES = [
  {
    key: 'base', name: 'Base ya construida', range: 'Sem 1–5 · 5 oct – 6 nov', note: 'Semanas aproximadas, según el historial',
    tasks: [
      { id: 'R1', name: 'Frontend de 21 secciones, modo demo y tracking', owner: 'Equipo', s: 1, e: 2, st: 'hecho',
        what: 'Cotizaciones, reservas, tarifas, facturación, contenedores, almacén, flota, documentos, alertas, reportes y panel SaaS; responsive; modo demo.', dep: '—' },
      { id: 'R2', name: 'Backend real de 23 módulos (Postgres + Mongo) y Swagger', owner: 'Equipo', s: 3, e: 4, st: 'hecho',
        what: 'Auth JWT + refresh, multi-tenant por tenant_id, roles, CRUD de todos los módulos y documentación OpenAPI.', dep: '—' },
      { id: 'R3', name: 'Seguridad: aislamiento, privilegios y referencias entre empresas', owner: 'Kevin', s: 4, e: 4, st: 'hecho',
        what: 'Registro restringido, escalada a super_admin cerrada, 14 vías de referencias cruzadas cerradas, límite de peticiones.', dep: '—' },
      { id: 'R4', name: 'CI en GitHub Actions y 201 pruebas automáticas', owner: 'Equipo', s: 4, e: 5, st: 'hecho',
        what: '38 unitarias, 151 de punta a punta contra bases reales y 12 de navegador; lint y build en cada push.', dep: '—' },
      { id: 'R5', name: 'Business Plan 2026 y landing con nuevo posicionamiento', owner: 'Kevin', s: 4, e: 4, st: 'hecho',
        what: 'Giro a Managed Supply Chain Control Tower; landing rediseñada.', dep: '—' },
      { id: 'R6', name: 'Control de órdenes de compra', owner: 'Equipo', s: 4, e: 4, st: 'hecho',
        what: 'Ciclo borrador → recibida, recepciones parciales con historial, alertas de fecha, pantallas y modo demo.', dep: '—' },
      { id: 'R7', name: 'Configuración por empresa y recepción → inventario', owner: 'Equipo', s: 5, e: 5, st: 'hecho',
        what: '4 perfiles de industria y 4 ajustes (tolerancia, alerta, fecha, inventario); la recepción suma al inventario.', dep: '—' },
    ],
  },
  {
    key: 'A', name: 'Fase A · MVP operable de abastecimiento', range: 'Sem 5–9 · 2 nov – 4 dic', note: 'Hito H2 · 11 dic (1 sem. de colchón)',
    tasks: [
      { id: 'A1', name: 'Vínculo OC ↔ embarque', owner: 'Ambos', s: 5, e: 5, st: 'hecho',
        what: 'Cada embarque indica qué cantidad de cada línea de OC trae; la OC muestra «en camino», la ETA real y alerta si un embarque llega tarde; un embarque puede traer varias OCs. Regla configurable: vincular despacha la OC.', dep: 'Control de OCs (hecho)' },
      { id: 'A2', name: 'Ramas protegidas, flujo de PR y CI que bloquea', owner: 'Kevin', s: 5, e: 6, st: 'siguiente',
        what: 'Listos: plantilla de PR, CODEOWNERS, CI en develop, guía en docs/CONTRIBUTING.md y badge. Falta activar la protección de main y crear develop en GitHub (15 min, solo el dueño del repo).', dep: '—' },
      { id: 'A3', name: 'ADRs de arquitectura (001–003)', owner: 'Kevin', s: 5, e: 5, st: 'hecho',
        what: 'Multi-tenancy por fila (con las reglas obligatorias de aislamiento), Postgres + Mongo y configuración por empresa, en docs/adr.', dep: '—' },
      { id: 'A4', name: 'Canal de contacto para «agendar diagnóstico»', owner: 'Kevin', s: 6, e: 6, st: 'pendiente', decision: true,
        what: 'Código escrito el 12 nov (sin ejecutar): formulario «Agenda tu diagnóstico» en la landing que guarda el contacto y avisa por correo al equipo (CONTACT_INBOX_EMAIL). Falta correr sus pruebas y que Kevin confirme si además quiere un botón de WhatsApp.', dep: 'Pruebas con Docker' },
      { id: 'A8', name: 'Pruebas e2e del frontend contra backend real y accesibilidad', owner: 'Dev', s: 6, e: 6, st: 'hecho',
        what: 'Segunda suite de Playwright contra la API real (9 flujos, incluido el aislamiento entre empresas) y auditoría de accesibilidad con axe en 29 pantallas: 0 violaciones WCAG A/AA (el contraste de color queda para una revisión de diseño).', dep: '—' },
      { id: 'A5', name: 'Importación de OCs desde CSV con mapeo por empresa', owner: 'Ambos', s: 5, e: 5, st: 'hecho',
        what: 'Detecta el separador, lee números y fechas al estilo de la región, valida fila por fila sin guardar, omite OCs existentes y recuerda el mapeo de columnas de cada empresa. También importa parámetros por SKU.', dep: 'Control de OCs (hecho)' },
      { id: 'A12', name: 'Importar archivos Excel (.xlsx), además de CSV', owner: 'Dev', s: 6, e: 6, st: 'hecho',
        what: 'El asistente de importación lee .xlsx directo (primera hoja) además de CSV: respeta números y fechas reales de Excel, descarta filas vacías y reporta la línea real de la hoja. Límite de 2 MB por archivo; el .xls antiguo se rechaza con un mensaje claro.', dep: 'A5' },
      { id: 'A6', name: 'Cobertura de inventario: consumo, seguridad y días', owner: 'Ambos', s: 5, e: 5, st: 'hecho',
        what: 'Parámetros por SKU (consumo, stock de seguridad, lead time), días de cobertura con alerta según la empresa y entradas previstas desde OCs y embarques; si el inventario vive en el ERP del cliente usa las existencias que reporta.', dep: 'Recepción → inventario (hecho)' },
      { id: 'A7', name: 'Redis + BullMQ (colas y tareas programadas)', owner: 'Kevin', s: 6, e: 6, st: 'hecho',
        what: 'Redis en Docker y CI, cola de mantenimiento con un trabajo programado que corre solo, reintentos y estado solo para super_admin. Base para evaluar reglas y enviar notificaciones y webhooks sin frenar la API.', dep: '—' },
      { id: 'A9', name: 'Deuda técnica: npm audit y cobertura ≥ 70%', owner: 'Dev', s: 8, e: 9, st: 'pendiente',
        what: 'Avance 7 nov: se quitó la crítica del backend (bcrypt 6) y las 4 altas del frontend sin cambio de versión mayor. Quedan 12 en el backend (migrar NestJS 10 → 12) y 2 en el frontend (Next 14 → 16, el crítico es de next): requieren tu aprobación porque cambian el stack. Falta además subir la cobertura de pruebas unitarias a ≥ 70%.', dep: '—' },
      { id: 'A10', name: 'API pública v1: API keys y webhooks por empresa', owner: 'Kevin', s: 7, e: 8, st: 'pendiente',
        what: 'Código escrito el 12 nov: API pública v1 de solo lectura con X-API-Key (guardada solo como huella, 300 peticiones/min), webhooks firmados con HMAC-SHA256 (secreto cifrado AES-256-GCM, protección SSRF, 5 reintentos, historial de entregas), eventos de envíos, OCs y riesgo, y la pantalla de Integraciones conectada. Falta correr las pruebas e2e con Docker.', dep: 'A7' },
      { id: 'A11', name: 'Notificaciones reales: correo y WhatsApp', owner: 'Dev', s: 7, e: 7, st: 'hecho',
        what: 'Envío real por correo (SMTP; en desarrollo Mailpit) y por WhatsApp Cloud API, a través de la cola con 3 reintentos, reenvío manual de las fallidas y validación de destinos. Para que WhatsApp envíe de verdad faltan las credenciales de la cuenta de Meta del cliente y, fuera de la ventana de 24 h, plantillas aprobadas; push y SMS siguen sin proveedor.', dep: 'A7' },
    ],
  },
  {
    key: 'B', name: 'Fase B · Control Tower: riesgo, excepciones y trabajo humano', range: 'Sem 8–14 · 23 nov – 8 ene', note: 'Hito H3 · 22 ene (2 sem. de colchón)',
    tasks: [
      { id: 'B1', name: 'Motor de riesgo de abastecimiento v1', owner: 'Kevin', s: 7, e: 7, st: 'hecho',
        what: 'Proyecta cuándo se acaba cada SKU y lo compara con la ETA de lo que llega: semáforo, días sin stock y acción recomendada (urgir al proveedor, partir envío, compra urgente, confirmar fecha, planificar). Motor puro con 21 pruebas, API GET /supply-risk, pantalla propia y 9 pruebas e2e. Es el diferenciador del Business Plan.', dep: 'A1, A6, A7' },
      { id: 'B1b', name: 'Riesgo: evaluación periódica y avisos', owner: 'Kevin', s: 8, e: 9, st: 'pendiente',
        what: 'Código escrito el 12 nov: evaluación cada hora con la cola, historial de cambios de semáforo, un correo por ronda con los SKU que pasaron a rojo (la empresa puede apagarlo en Configuración), evento de webhook y botón «Evaluar ahora». Falta correr las pruebas con Docker. Sigue pendiente: fechas de llegada para OCs que aún no viajan.', dep: 'B1, A11' },
      { id: 'B2', name: 'Dashboard Control Tower (vista de riesgo)', owner: 'Dev', s: 10, e: 12, st: 'pendiente',
        what: 'Reemplaza el resumen centrado en envíos: SKUs en riesgo, OCs atrasadas, vencimientos próximos y tareas del día.', dep: 'B1' },
      { id: 'B3', name: 'Workflow humano: tareas, comentarios y bitácora', owner: 'Ambos', s: 11, e: 13, st: 'pendiente',
        what: 'Código escrito el 13 nov (sin ejecutar el stack): tareas con responsable, prioridad, fecha límite y vínculo a una OC, envío o SKU; comentarios; bitácora de quién hizo qué y cuándo (solo se agrega); pantalla Tareas. Falta correr sus pruebas e2e y de navegador. Sigue pendiente: evidencia adjunta y avisos al asignar.', dep: 'A7' },
      { id: 'B4', name: 'Centro de excepciones: reglas, severidad, SLA y escalamiento', owner: 'Ambos', s: 12, e: 14, st: 'pendiente',
        what: 'Código escrito el 13 nov (sin ejecutar el stack): SKU en rojo y OC atrasada abren una excepción con plazo (SLA) configurable por empresa y una tarea; se resuelve sola cuando el problema desaparece y, si el plazo vence, escala a crítica y avisa por correo a los administradores. Pantalla Excepciones. Falta correr sus pruebas e2e. Pendiente: reglas de documento faltante (con C1) y responsable por regla.', dep: 'B1, B3' },
      { id: 'B5', name: 'Roles analista_sutl y proveedor', owner: 'Kevin', s: 12, e: 13, st: 'pendiente',
        what: 'El analista de SUTL ve varias empresas clientes con permisos explícitos, sin romper el aislamiento; el proveedor ve solo sus OCs.', dep: 'B3' },
    ],
  },
  {
    key: 'C', name: 'Fase C · Portal colaborativo, analítica y panel SaaS', range: 'Sem 14–22 · 4 ene – 5 mar', note: 'Hito H4 · 19 feb (con colchón)',
    tasks: [
      { id: 'C1', name: 'Checklist de documentos por operación y vencimientos', owner: 'Dev', s: 15, e: 16, st: 'pendiente',
        what: 'Documentos exigidos por tipo de operación (factura, packing list, BL, certificados), estado, vencimientos y alertas.', dep: 'B4' },
      { id: 'C2', name: 'MFA (TOTP) y bitácora de auditoría completa', owner: 'Kevin', s: 14, e: 15, st: 'pendiente',
        what: 'Código escrito el 13 nov (sin ejecutar el stack): segundo factor TOTP (Google/Microsoft Authenticator, Authy) con códigos de recuperación, bloqueo por fallos y restablecimiento por el administrador; bitácora de ingresos, fallos, cambios de segundo factor y altas, roles y desactivaciones de usuarios. Falta correr sus pruebas e2e. Pendiente: exigirlo a administradores por política, código QR en pantalla y visor de bitácora.', dep: '—' },
      { id: 'C3', name: 'Portal colaborativo para proveedor y cliente', owner: 'Ambos', s: 17, e: 19, st: 'pendiente',
        what: 'El proveedor confirma fechas y sube documentos desde su acceso; el cliente final ve el estado; todo queda en la bitácora.', dep: 'B3, B5' },
      { id: 'C4', name: 'Analítica: OTIF, lead time, aging y cumplimiento', owner: 'Ambos', s: 18, e: 20, st: 'pendiente',
        what: 'KPIs por proveedor, operador y ruta; primer score de proveedor; exportables.', dep: 'A1, B4' },
      { id: 'C5', name: 'Planes, suscripción y pasarela de pago', owner: 'Kevin', s: 16, e: 17, st: 'pendiente',
        what: 'Planes y límites reales por empresa y cobro recurrente; hoy la pantalla de plan es demo.', dep: 'Elegir pasarela' },
      { id: 'C6', name: 'POD y recepción nacional conectada a la OC', owner: 'Dev', s: 19, e: 20, st: 'pendiente',
        what: 'Prueba de entrega con firma o foto; la recepción en destino queda ligada a la OC y al inventario.', dep: 'A1' },
      { id: 'C7', name: 'Tiempo real (WebSockets) y mapas en el seguimiento', owner: 'Ambos', s: 16, e: 17, st: 'pendiente',
        what: 'Actualización en vivo de estados y mapa de ruta con Google Maps.', dep: 'A7' },
      { id: 'C8', name: 'Tracking público con la marca de cada empresa', owner: 'Dev', s: 20, e: 21, st: 'pendiente',
        what: 'Portal white-label: logo, colores y dominio por empresa.', dep: '—' },
      { id: 'C9', name: 'Facturación electrónica SRI', owner: 'Ambos', s: 19, e: 22, st: 'pendiente',
        what: 'XML firmado, autorización del SRI y RIDE para cobrar el servicio de SUTL. Los tiempos del SRI son externos.', dep: 'Firma electrónica (trámite)' },
    ],
  },
  {
    key: 'D', name: 'Fase D · Nube, seguridad y salida a producción', range: 'Sem 6–25 · en paralelo', note: 'Hito GL · 22 mar',
    tasks: [
      { id: 'D1', name: 'Decisión de nube y creación de cuentas', owner: 'Kevin', s: 6, e: 6, st: 'pendiente', decision: true,
        what: 'Definir dónde vive staging (propuesta: staging liviano con Supabase + Atlas + Vercel + un host de contenedores, y AWS completo solo para producción) y crear las cuentas.', dep: 'Decisión de Kevin' },
      { id: 'D2', name: 'Staging en línea', owner: 'Kevin', s: 8, e: 11, st: 'pendiente',
        what: 'Base gestionada, backend y frontend desplegados, variables seguras, migraciones y datos de demo. Es lo que permite que un design partner use SUTL.', dep: 'D1' },
      { id: 'D3', name: 'Observabilidad: Sentry y logs', owner: 'Kevin', s: 11, e: 12, st: 'pendiente',
        what: 'Errores y trazas con alertas y logs centralizados.', dep: 'D2' },
      { id: 'D4', name: 'AWS de producción con Terraform', owner: 'Kevin', s: 18, e: 21, st: 'pendiente',
        what: 'ECS Fargate, Aurora Multi-AZ, WAF, CloudFront, Secrets Manager y despliegue por OIDC sin llaves largas.', dep: 'D1' },
      { id: 'D5', name: 'Hardening, pentest y prueba de carga', owner: 'Kevin', s: 21, e: 22, st: 'pendiente',
        what: 'Revisión OWASP, pentest y carga sobre los endpoints críticos, con correcciones.', dep: 'D4' },
      { id: 'D6', name: 'Backups y prueba de restauración (PITR)', owner: 'Kevin', s: 22, e: 22, st: 'pendiente',
        what: 'Respaldo automático y simulacro de restauración antes del go-live.', dep: 'D4' },
      { id: 'D7', name: 'UAT con design partners y correcciones', owner: 'Ambos', s: 22, e: 23, st: 'pendiente',
        what: 'Pruebas de aceptación con clientes reales; lista de defectos y cierre.', dep: 'E3, D2' },
      { id: 'D8', name: 'Runbooks y documentación operativa', owner: 'Dev', s: 22, e: 23, st: 'pendiente',
        what: 'Guías de despliegue, incidentes, respaldo, alta de empresa y onboarding.', dep: '—' },
      { id: 'D9', name: 'Go / No-Go y salida a producción', owner: 'Kevin', s: 24, e: 25, st: 'pendiente',
        what: 'Checklist de salida, aprobación y despliegue con versión etiquetada.', dep: 'D5 a D8' },
    ],
  },
  {
    key: 'E', name: 'Fase E · Comercial: entrevistas, design partners y piloto', range: 'Sem 5–25 · en paralelo', note: 'Meta: ≥ 1 contrato anual',
    tasks: [
      { id: 'E1', name: '15–20 entrevistas con el cliente ideal', owner: 'Kevin', s: 5, e: 9, st: 'pendiente',
        what: 'Importadores, manufactura y agro con 50+ SKUs críticos y 3+ operadores logísticos. Falta confirmar el avance real.', dep: '—' },
      { id: 'E2', name: 'Elegir 2–3 design partners', owner: 'Kevin', s: 9, e: 11, st: 'pendiente', decision: true,
        what: 'Vertical inicial (agro/alimentos o manufactura), acuerdo de piloto y baseline de métricas.', dep: 'E1' },
      { id: 'E3', name: 'Piloto de 12 semanas con design partners', owner: 'Ambos', s: 14, e: 25, st: 'pendiente',
        what: 'Diagnóstico (sem 1–2 del piloto), Configuración (2–3), Operación (4–8), Evaluación (9–10), Conversión (10–12). Meta: al menos 1 contrato anual.', dep: 'D2, A5, B1' },
    ],
  },
];

const COVERAGE = [
  ['Control de OCs', 'hecho', 'Enlazado a embarques e importable por CSV', 'A1, A5 · Sem 5'],
  ['Seguimiento de embarques', 'hecho', 'Enlazado con las OCs que trae', 'A1 · Sem 5'],
  ['Inventario y cobertura', 'hecho', 'Falta el motor de riesgo que lo usa', 'A6 · Sem 5'],
  ['Motor de riesgo de abastecimiento', 'falta', 'Diferenciador clave', 'B1 · Sem 8–10'],
  ['Control Tower (vista de riesgo)', 'parcial', 'Hoy el panel es de envíos', 'B2 · Sem 10–12'],
  ['Workflow humano (tareas)', 'falta', 'No existe', 'B3 · Sem 11–13'],
  ['Motor de excepciones', 'parcial', 'Faltan SLA y escalamiento', 'B4 · Sem 12–14'],
  ['Roles analista y proveedor', 'parcial', 'Hoy: 4 roles', 'B5 · Sem 12–13'],
  ['Portal colaborativo', 'parcial', 'Solo tracking público', 'C3 · Sem 17–19'],
  ['Documentos', 'parcial', 'Falta checklist y vencimientos', 'C1 · Sem 15–16'],
  ['Analítica (OTIF, lead time)', 'parcial', 'Reportes sin estas métricas', 'C4 · Sem 18–20'],
  ['Movimientos nacionales y POD', 'parcial', 'Falta POD', 'C6 · Sem 19–20'],
  ['Seguridad (RBAC, MFA, auditoría)', 'parcial', 'RBAC y aislamiento listos; falta MFA', 'C2 · Sem 14–15'],
];

const YA_FUNCIONA = [
  ['Abastecimiento', [
    'Control de OCs: ciclo borrador → recibida, recepciones parciales con historial y alerta de fecha.',
    'Vínculo OC ↔ embarque: qué carga de cada línea viaja en cada embarque, con alerta por la llegada real.',
    'Cobertura de inventario: consumo, stock de seguridad y días de cobertura por SKU, con alerta configurable.',
    'Importación de OCs y de parámetros por SKU desde CSV, con mapeo de columnas guardado por empresa.',
    'La recepción suma al inventario (bodega, SKU y movimiento), con cantidades decimales.',
    'Configuración por empresa: 4 perfiles de industria y 4 ajustes que el backend aplica de verdad.',
  ]],
  ['Operación logística', [
    'Envíos con tracking por hitos (Mongo) y tracking público por código de guía.',
    'Cotizaciones, reservas, tarifas y contratos, facturación, contenedores, navieras, almacén, flota, documentos, alertas, notificaciones y reportes.',
  ]],
  ['Plataforma y seguridad', [
    'Multi-tenant por fila con tenant_id, probado de punta a punta en todos los módulos.',
    'Login JWT con refresh, 4 roles, límite de peticiones y registro restringido.',
    'Escalada a super_admin cerrada y referencias entre empresas validadas.',
  ]],
  ['Producto visible', [
    'Landing con el posicionamiento Control Tower, login, panel de 21 secciones, responsive y modo demo desplegable en Vercel.',
    'Documentación Swagger/OpenAPI de la API.',
  ]],
  ['Calidad', [
    'CI en GitHub Actions, 201 pruebas automáticas, lint, tsc y build limpios, ADRs y documento de estado vivo.',
  ]],
];

const FALTA = [
  ['Entornos', [
    'Staging y producción en línea; hoy todo corre en local (D1, D2, D4).',
    'Observabilidad, backups con simulacro de restauración y pentest (D3, D5, D6).',
  ]],
  ['Producto de abastecimiento', [
    'Motor de riesgo de abastecimiento: quiebre de stock vs. llegada prevista (B1).',
    'Importar archivos Excel (.xlsx) directo (A12) y API pública con webhooks para conectar el ERP (A10).',
  ]],
  ['Control Tower gestionado', [
    'Dashboard de riesgo, tareas y bitácora, excepciones con SLA y escalamiento (B2, B3, B4).',
    'Roles analista y proveedor, y portal colaborativo (B5, C3).',
  ]],
  ['Plataforma', [
    'Redis y colas, notificaciones reales, tiempo real y mapas (A7, A11, C7).',
    'MFA y bitácora de auditoría completa (C2).',
  ]],
  ['Negocio', [
    'Planes con pasarela de pago y facturación electrónica SRI (C5, C9).',
    'Entrevistas, design partners y piloto con un cliente real (E1–E3).',
    'Canal de contacto real en la landing (A4).',
  ]],
];

const RIESGOS = [
  ['Entorno en línea sin definir', 'Sin staging no hay piloto con un cliente real; es la ruta crítica del cronograma.', 'Decidir nube y crear cuentas antes de la Sem 6 (13 nov). Propuesta: staging liviano primero, AWS completo después.'],
  ['Equipo de dos personas', 'Una ausencia detiene el avance (ya señalado en el Plan Maestro).', 'PRs pequeños, ADRs y documentación al día, revisión cruzada.'],
  ['Semanas con muchos frentes', 'Las Sem 6–8 y 19–22 concentran entre 5 y 6 tareas en paralelo; Navidad, Año Nuevo y Carnaval bajan la capacidad.', 'Estimaciones con ±1 semana de margen y las Fases A y B terminan antes de lo que exige el Plan Maestro; si algo se atrasa, se mueve primero C8 y C9, no las Fases A y B.'],
  ['Construir antes de validar', 'El Business Plan pide convertir al menos un piloto antes de ampliar el desarrollo.', 'El cronograma llega solo hasta el MVP + Control Tower. Lo que sigue queda tras la compuerta de validación (ver última página).'],
  ['SRI y pasarela de pago', 'Dependen de trámites externos (firma electrónica, ambiente de pruebas del SRI, cuenta de la pasarela).', 'Iniciar los trámites en la Sem 12, antes de programar.'],
  ['ERPs distintos en cada cliente', 'Cada ERP exporta distinto; un conector por cliente no escala.', 'Primero Excel/CSV con mapeo por empresa y API pública; conectores específicos solo bajo cotización, tras el piloto.'],
  ['Deuda de dependencias', '12 vulnerabilidades de npm audit exigen subir NestJS a v12.', 'Tarea A9 en las Sem 8–9, con las pruebas actuales como red de seguridad.'],
];

const DECISIONES = [
  ['Nube: cuándo y dónde', 'Staging liviano (Supabase + Atlas + Vercel + host de contenedores) y AWS completo solo para producción, o AWS desde el inicio.', 'Sem 6 · 13 nov'],
  ['Canal de contacto de la landing', 'WhatsApp, correo o formulario con aviso. Hoy el botón «agendar diagnóstico» no lleva a ninguna parte.', 'Sem 6 · 13 nov'],
  ['Vertical del primer design partner', 'Agro y alimentos o manufactura (el Business Plan sugiere uno de los dos; pharma queda para después por ARCSA).', 'Sem 9 · 4 dic'],
  ['Avance de las entrevistas', 'No tengo información de cuántas entrevistas van; confirma para ajustar E1 y E2.', 'Sem 6 · 13 nov'],
  ['Horas semanales del dev de apoyo', 'Para calibrar cuánto de cada tarea se reparte a «Dev» sin cargar de más a una persona.', 'Sem 6 · 13 nov'],
];

const HORIZONTE = [
  { rango: 'Abr – oct 2027', titulo: 'Supply Control completo', items: [
    'Priorización de compras y recomendaciones de pedido.',
    'Score de proveedor avanzado.',
    'Conectores a los ERPs de los design partners, bajo cotización.',
    'Ingesta automática de hitos con los primeros adaptadores de naviera y courier.',
  ] },
  { rango: 'Oct 2027 – abr 2028', titulo: 'Automatización y autoabastecimiento', items: [
    'Autoabastecimiento gestionado: SVK reabastece por el cliente (la última funcionalidad grande).',
    'OCR de documentos y playbooks de respuesta a excepciones.',
    'Más adaptadores de ingesta de hitos.',
  ] },
  { rango: 'Abr – oct 2028', titulo: 'Escala', items: [
    'Benchmarking entre empresas y analítica predictiva.',
    'Multi-país y marketplace de conectores.',
    'App móvil (React Native): hoy fuera de alcance; se evalúa aquí.',
  ] },
];

// Lo cerrado en la semana 5 (2–6 nov).
const LOGROS_SEMANA = [
  ['Configuración de la operación por empresa y recepción de OC al inventario', 'ya estaba, 3 nov'],
  ['Fuga entre empresas cerrada: las referencias del body se validan por empresa', '14 vías'],
  ['Vínculo OC ↔ embarque, con alerta por la llegada real del embarque', 'A1'],
  ['Cobertura de inventario por SKU, con alerta configurable por empresa', 'A6'],
  ['Importación de OCs y de parámetros por SKU desde CSV, con mapeo guardado por empresa', 'A5'],
  ['Corregido: las importaciones grandes fallaban con error interno y los errores inesperados no quedaban en el log', 'defecto'],
  ['ADRs 001–003, plantilla de PR, CODEOWNERS y CI ampliado', 'A3 y parte de A2'],
  ['201 pruebas automáticas en verde y verificación en navegador contra el backend real', 'calidad'],
];

// Qué cambió respecto de la versión anterior del cronograma.
const CAMBIOS = [
  'Se cerraron A1, A3, A5 (CSV) y A6 en la semana 5; estaban planeadas para las semanas 5 a 9.',
  'La Fase A termina en la semana 9 (antes la 10) y la Fase B se adelanta 2 semanas: el motor de riesgo arranca en la semana 8.',
  'Se adelantan C1, C2, C5 y C7 para repartir la carga: ninguna semana pasa de 6 tareas en paralelo.',
  'Tarea nueva A12: leer archivos Excel (.xlsx) directo; hoy el asistente lee CSV.',
  'Los hitos del Plan Maestro no se mueven: quedan con 1 a 2 semanas de colchón.',
];

// Plan de la semana 6 (9–13 nov): qué, quién y cuándo se da por hecho.
const PLAN_SEMANA = [
  { id: 'D1', titulo: 'Decidir la nube y crear las cuentas', resp: 'Kevin', hecho: 'Decisión tomada (staging liviano o AWS) y cuentas creadas.', nota: 'Ruta crítica: sin staging no hay piloto con un cliente real.', decision: true },
  { id: 'A2', titulo: 'Activar la protección de ramas en GitHub', resp: 'Kevin', hecho: 'main y develop protegidas (PR con CI en verde y 1 aprobación) y develop creada.', nota: '15 min en Settings → Branches; pasos en docs/CONTRIBUTING.md.' },
  { id: 'A4', titulo: 'Canal de contacto de la landing', resp: 'Kevin', hecho: 'El botón «agendar diagnóstico» entrega los datos a WhatsApp, correo o un formulario.', nota: 'Necesita tu decisión de canal.', decision: true },
  { id: 'A7', titulo: 'Redis + BullMQ', resp: 'Kevin', hecho: 'Redis en Docker Compose, módulo de colas con una tarea programada de prueba y sus pruebas.', nota: 'Base de la evaluación periódica de reglas, de las notificaciones y de los webhooks.' },
  { id: 'A8', titulo: 'Pruebas e2e del frontend contra el backend real y accesibilidad', resp: 'Dev', hecho: 'Segunda suite de Playwright contra la API real y labels asociados en los formularios antiguos.', nota: 'Hoy solo hay pruebas en modo demo.' },
  { id: 'E1', titulo: 'Entrevistas con el cliente ideal (sigue)', resp: 'Kevin', hecho: 'Avance confirmado y lista de candidatos a design partner.', nota: 'No tengo datos de cuántas llevas.' },
];

module.exports = {
  TOTAL_WEEKS, TODAY_WEEK, NEXT_WEEK, LOGROS_SEMANA, CAMBIOS, PLAN_SEMANA, MONTHS_HEADER, MILESTONES, PHASES, COVERAGE, YA_FUNCIONA, FALTA, RIESGOS, DECISIONES, HORIZONTE,
  weekStart, fmt, semanas, fechas, addDays,
};
