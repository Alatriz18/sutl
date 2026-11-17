// Datos del cronograma SUTL. Semana 1 = lunes 5 oct 2026 (Sprint 1 del Plan Maestro v1.0).
// Estados: hecho (probado) | codigo (código escrito y con pruebas unitarias, falta probarlo con el stack completo)
//         | siguiente | pendiente. decision:true = depende de una decisión de Kevin.

const TOTAL_WEEKS = 25; // semana 25 = salida a producción (22 mar 2027)
const TODAY_WEEK = 6; // corte: sábado 14 nov 2026, fin de la semana 6
const NEXT_WEEK = 7; // plan: 16–20 nov

// Fecha de corte y textos que cambian en cada actualización.
const CORTE = { fecha: '14 de noviembre de 2026', corta: '14 nov', semana: 6, rangoSemana: '9 al 14 de noviembre', proxima: '16–20 nov' };

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
      { id: 'A4', name: 'Canal de contacto para «agendar diagnóstico»', owner: 'Kevin', s: 6, e: 6, st: 'hecho', decision: true,
        what: 'Hecho y probado el 14 nov: formulario «Agenda tu diagnóstico» en la landing que guarda el contacto y avisa por correo al equipo (CONTACT_INBOX_EMAIL).', dep: 'Pruebas con Docker' },
      { id: 'A8', name: 'Pruebas e2e del frontend contra backend real y accesibilidad', owner: 'Dev', s: 6, e: 6, st: 'hecho',
        what: 'Segunda suite de Playwright contra la API real (9 flujos, incluido el aislamiento entre empresas) y auditoría de accesibilidad con axe en 29 pantallas: 0 violaciones WCAG A/AA (el contraste de color queda para una revisión de diseño).', dep: '—' },
      { id: 'A5', name: 'Importación de OCs desde CSV con mapeo por empresa', owner: 'Ambos', s: 5, e: 5, st: 'hecho',
        what: 'Detecta el separador, lee números y fechas al estilo de la región, valida fila por fila sin guardar, omite OCs existentes y recuerda el mapeo de columnas de cada empresa. También importa parámetros por SKU.', dep: 'Control de OCs (hecho)' },
      { id: 'A13', name: 'Verificar con el stack completo lo escrito sin ejecutarlo', owner: 'Ambos', s: 6, e: 6, st: 'hecho',
        what: 'Hecho el 14 nov: las 8 migraciones nuevas aplicadas en Postgres real, 291 pruebas e2e del backend y 59+14 de navegador en verde. Encontró y corrigió dos fallos de prueba y un defecto de fondo: ninguna migración creaba las tablas base (partners, cotizaciones, almacén, flota…), así que una base vacía no podía migrar; se agregó la migración puente 20261001000000. Medición de cobertura pendiente (A9).', dep: 'A4, A10, B1b–B5, C1, C2' },
      { id: 'A12', name: 'Importar archivos Excel (.xlsx), además de CSV', owner: 'Dev', s: 6, e: 6, st: 'hecho',
        what: 'El asistente de importación lee .xlsx directo (primera hoja) además de CSV: respeta números y fechas reales de Excel, descarta filas vacías y reporta la línea real de la hoja. Límite de 2 MB por archivo; el .xls antiguo se rechaza con un mensaje claro.', dep: 'A5' },
      { id: 'A6', name: 'Cobertura de inventario: consumo, seguridad y días', owner: 'Ambos', s: 5, e: 5, st: 'hecho',
        what: 'Parámetros por SKU (consumo, stock de seguridad, lead time), días de cobertura con alerta según la empresa y entradas previstas desde OCs y embarques; si el inventario vive en el ERP del cliente usa las existencias que reporta.', dep: 'Recepción → inventario (hecho)' },
      { id: 'A7', name: 'Redis + BullMQ (colas y tareas programadas)', owner: 'Kevin', s: 6, e: 6, st: 'hecho',
        what: 'Redis en Docker y CI, cola de mantenimiento con un trabajo programado que corre solo, reintentos y estado solo para super_admin. Base para evaluar reglas y enviar notificaciones y webhooks sin frenar la API.', dep: '—' },
      { id: 'A9', name: 'Deuda técnica: npm audit y cobertura ≥ 70%', owner: 'Dev', s: 8, e: 9, st: 'hecho',
        what: 'Hecho el 17 nov: NestJS 10 → 11 y Next 14 → 16 (React 19, Recharts 3) con la suite completa en verde (426 unitarias, 331 e2e, 64+19 de navegador). Las dependencias de producción quedan en 0 vulnerabilidades en backend y frontend; lo que reporta npm audit es herramienta de desarrollo (Jest, CLI). NestJS 12 se descartó por ahora: es solo ESM y obliga a migrar todo el backend. Pendiente: medir cobertura ≥ 70% con las pruebas e2e.', dep: '—' },
      { id: 'A10', name: 'API pública v1: API keys y webhooks por empresa', owner: 'Kevin', s: 6, e: 6, st: 'hecho',
        what: 'Hecho y probado (14 nov): API pública v1 de solo lectura con X-API-Key (guardada solo como huella, 300 peticiones/min), webhooks firmados con HMAC-SHA256 (secreto cifrado AES-256-GCM, protección SSRF, 5 reintentos, historial de entregas), eventos de envíos, OCs y riesgo, y la pantalla de Integraciones conectada.', dep: 'A7' },
      { id: 'A11', name: 'Notificaciones reales: correo y WhatsApp', owner: 'Dev', s: 7, e: 7, st: 'hecho',
        what: 'Envío real por correo (SMTP; en desarrollo Mailpit) y por WhatsApp Cloud API, a través de la cola con 3 reintentos, reenvío manual de las fallidas y validación de destinos. Para que WhatsApp envíe de verdad faltan las credenciales de la cuenta de Meta del cliente y, fuera de la ventana de 24 h, plantillas aprobadas; push y SMS siguen sin proveedor.', dep: 'A7' },
    ],
  },
  {
    key: 'B', name: 'Fase B · Control Tower: riesgo, excepciones y trabajo humano', range: 'Sem 8–14 · 23 nov – 8 ene', note: 'Hito H3 · 22 ene (2 sem. de colchón)',
    tasks: [
      { id: 'B1', name: 'Motor de riesgo de abastecimiento v1', owner: 'Kevin', s: 7, e: 7, st: 'hecho',
        what: 'Proyecta cuándo se acaba cada SKU y lo compara con la ETA de lo que llega: semáforo, días sin stock y acción recomendada (urgir al proveedor, partir envío, compra urgente, confirmar fecha, planificar). Motor puro con 21 pruebas, API GET /supply-risk, pantalla propia y 9 pruebas e2e. Es el diferenciador del Business Plan.', dep: 'A1, A6, A7' },
      { id: 'B1b', name: 'Riesgo: evaluación periódica y avisos', owner: 'Kevin', s: 6, e: 6, st: 'hecho',
        what: 'Hecho y probado (14 nov): evaluación cada hora con la cola, historial de cambios de semáforo, un correo por ronda con los SKU que pasaron a rojo (la empresa puede apagarlo en Configuración), evento de webhook y botón «Evaluar ahora». Sigue pendiente: fechas de llegada para OCs que aún no viajan.', dep: 'B1, A11' },
      { id: 'B2', name: 'Dashboard Control Tower (vista de riesgo)', owner: 'Dev', s: 6, e: 6, st: 'hecho',
        what: 'Hecho y probado el 14 nov: la pantalla de Resumen abre con la torre de control (SKU en rojo, OC atrasadas, excepciones abiertas, tareas vencidas, SKU en riesgo con su acción recomendada, mis tareas de hoy y vencimientos de los próximos 7 días) y debajo conserva los envíos. API GET /control-tower.', dep: 'B1' },
      { id: 'B3', name: 'Workflow humano: tareas, comentarios y bitácora', owner: 'Ambos', s: 6, e: 6, st: 'hecho',
        what: 'Hecho y probado el 14 nov: tareas con responsable, prioridad, fecha límite y vínculo a una OC, envío o SKU; comentarios; bitácora de quién hizo qué y cuándo (solo se agrega); pantalla Tareas. Sigue pendiente: evidencia adjunta y avisos al asignar.', dep: 'A7' },
      { id: 'B4', name: 'Centro de excepciones: reglas, severidad, SLA y escalamiento', owner: 'Ambos', s: 6, e: 6, st: 'hecho',
        what: 'Hecho y probado el 14 nov: SKU en rojo y OC atrasada abren una excepción con plazo (SLA) configurable por empresa y una tarea; se resuelve sola cuando el problema desaparece y, si el plazo vence, escala a crítica y avisa por correo a los administradores. Pantalla Excepciones. Regla de documento faltante hecha con C1 (14 nov). Pendiente: responsable por regla y aviso por WhatsApp.', dep: 'B1, B3' },
      { id: 'B5', name: 'Roles analista_sutl y proveedor', owner: 'Kevin', s: 6, e: 6, st: 'hecho',
        what: 'Hecho y probado el 14 nov: el analista de SUTL trabaja en empresas cliente solo con un permiso explícito que otorga el super_admin (solo lectura por defecto, revocable al instante, con el ingreso anotado en la bitácora de la empresa) y elige la empresa en la barra superior; el proveedor externo queda ligado a un proveedor, solo ve sus OC ya emitidas sin datos internos y todo lo demás le está vedado por defecto. Pendiente: exigir segundo factor a analistas y avisos a proveedores.', dep: 'B3' },
    ],
  },
  {
    key: 'C', name: 'Fase C · Portal colaborativo, analítica y panel SaaS', range: 'Sem 14–22 · 4 ene – 5 mar', note: 'Hito H4 · 19 feb (con colchón)',
    tasks: [
      { id: 'C1', name: 'Checklist de documentos por operación y vencimientos', owner: 'Dev', s: 6, e: 6, st: 'hecho',
        what: 'Hecho y probado el 14 nov: cada envío exige los documentos que la empresa configure (factura, lista de empaque, BL o AWB según el modo, pedimento en importaciones); cada documento se aprueba o rechaza con motivo, tiene versión vigente y fecha de vencimiento (vencido / por vencer); checklist en el detalle del envío; un envío por llegar sin su documentación abre una excepción (regla pendiente de B4) y los documentos por vencer salen en la torre de control.', dep: 'B4' },
      { id: 'C2', name: 'MFA (TOTP) y bitácora de auditoría completa', owner: 'Kevin', s: 6, e: 6, st: 'hecho',
        what: 'Hecho y probado el 14 nov: segundo factor TOTP (Google/Microsoft Authenticator, Authy) con códigos de recuperación, bloqueo por fallos y restablecimiento por el administrador; bitácora de ingresos, fallos, cambios de segundo factor y altas, roles y desactivaciones de usuarios. Pendiente: exigirlo a administradores por política, código QR en pantalla y visor de bitácora.', dep: '—' },
      { id: 'C3', name: 'Portal colaborativo para proveedor y cliente', owner: 'Ambos', s: 6, e: 6, st: 'hecho',
        what: 'Hecho y probado el 14 nov: el proveedor confirma sus órdenes con su fecha de despacho y conversa con la empresa; el cliente final entra a un portal de solo lectura con SUS envíos (seguimiento sin datos internos) y conversa sobre ellos; la empresa ve y responde desde el detalle de la OC y del envío, con aviso por correo a cada lado y bitácora. Corrige un hueco: antes un cliente final podía ver todos los envíos de la empresa y crear envíos y eventos. Actualización 17 nov: documentos compartidos (el equipo decide con quién; el cliente y el proveedor ven lo suyo y suben los suyos, con aviso). Pendiente: que el proveedor registre el despacho real.', dep: 'B3, B5' },
      { id: 'C4', name: 'Analítica: OTIF, lead time, aging y cumplimiento', owner: 'Ambos', s: 6, e: 6, st: 'hecho',
        what: 'Hecho y probado el 14 nov: pantalla y API GET /analytics/resumen con OTIF (a tiempo y completas), lead time (promedio, mediana, P90), atraso de las OC abiertas por tramos, tendencia de 6 meses, cumplimiento de la fecha prometida por el proveedor y puntualidad de los envíos, con detalle por proveedor ordenado del peor al mejor. Definiciones visibles en pantalla. Pendiente: exportar a Excel y metas por empresa.', dep: 'A1, B4' },
      { id: 'C5', name: 'Planes, suscripción y pasarela de pago', owner: 'Kevin', s: 16, e: 17, st: 'pendiente',
        what: 'Planes y límites reales por empresa y cobro recurrente; hoy la pantalla de plan es demo.', dep: 'Elegir pasarela' },
      { id: 'C6', name: 'POD y recepción nacional conectada a la OC', owner: 'Dev', s: 6, e: 6, st: 'hecho',
        what: 'Hecho y probado el 14 nov: el equipo registra la prueba de entrega (quién recibió, documento, fecha, observaciones y evidencia en foto o PDF), el envío pasa a «Entregado» con su evento en el seguimiento, y si se pide, la carga que viajaba se recibe en cada orden de compra (sin pasar de lo que falta, con las reglas de inventario de la empresa y resultado por OC). Una sola prueba por envío; el cliente final ve la de SUS envíos y descarga la evidencia. Pendiente: firma en pantalla y fotos desde el celular.', dep: 'A1' },
      { id: 'C7', name: 'Tiempo real y mapa del recorrido en el seguimiento', owner: 'Ambos', s: 16, e: 17, st: 'hecho',
        what: 'Hecho y probado el 17 nov, sin dependencias nuevas: la página pública, el detalle del envío y el portal del cliente se actualizan solos cuando la empresa registra un movimiento (Server-Sent Events, con reconexión automática e indicador «En vivo»), y dibujan el recorrido en un mapa propio en SVG a partir de las coordenadas del evento (que el equipo puede capturar). La conexión pública solo abre para códigos que existen y no lleva datos internos; el equipo y el cliente final solo siguen lo suyo. No se usó Google Maps: cuando se quiera un mapa con calles hará falta una cuenta con el proveedor. Límite: la difusión es por servidor; con varias réplicas hay que pasarla a Redis.', dep: 'A7' },
      { id: 'C8', name: 'Tracking público con la marca de cada empresa', owner: 'Dev', s: 6, e: 6, st: 'hecho',
        what: 'Hecho y probado el 14 nov: cada empresa configura nombre comercial, color de acento, logo (https), mensaje al cliente y si se muestra «Con tecnología de SUTL», con vista previa en Configuración; la página pública de seguimiento la aplica (con texto legible sobre el color elegido) y el servidor descarta colores o logos mal formados. De paso se cerró una fuga: la ruta pública devolvía el correo del responsable interno de cada evento. Pendiente: dominio propio de la empresa.', dep: '—' },
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
  ['Control de OCs', 'hecho', 'Enlazado a embarques; importable por CSV y Excel', 'A1, A5, A12 · Sem 5–6'],
  ['Seguimiento de embarques', 'hecho', 'Enlazado con las OCs que trae', 'A1 · Sem 5'],
  ['Inventario y cobertura', 'hecho', 'Alimenta el motor de riesgo', 'A6 · Sem 5'],
  ['Motor de riesgo de abastecimiento', 'hecho', 'Semáforo, acción recomendada y evaluación periódica con aviso', 'B1, B1b · Sem 6'],
  ['Control Tower (vista de riesgo)', 'hecho', 'Resumen con riesgo, OC atrasadas, tareas y vencimientos', 'B2 · Sem 6'],
  ['Workflow humano (tareas)', 'hecho', 'Tareas, comentarios y bitácora; falta evidencia adjunta', 'B3 · Sem 6'],
  ['Motor de excepciones', 'hecho', 'Plazo, escalamiento y documentos faltantes', 'B4 · Sem 6'],
  ['Roles analista y proveedor', 'hecho', 'Acceso explícito y revocable; falta exigirles segundo factor', 'B5 · Sem 6'],
  ['Portal colaborativo', 'hecho', 'Proveedor y cliente final con su portal, conversación y confirmación', 'C3 · Sem 6'],
  ['Documentos', 'hecho', 'Checklist por envío, revisión y vencimientos', 'C1 · Sem 6'],
  ['Analítica (OTIF, lead time)', 'hecho', 'OTIF, lead time, atrasos y detalle por proveedor', 'C4 · Sem 6'],
  ['Movimientos nacionales y POD', 'hecho', 'Prueba de entrega con evidencia y recepción de la OC', 'C6 · Sem 6'],
  ['Seguridad (RBAC, MFA, auditoría)', 'parcial', 'Segundo factor y bitácora listos; falta exigirlo por política', 'C2 · Sem 6'],
];

const YA_FUNCIONA = [
  ['Abastecimiento', [
    'Control de OCs: ciclo borrador → recibida, recepciones parciales con historial y alerta de fecha.',
    'Vínculo OC ↔ embarque con alerta por la llegada real; cobertura de inventario por SKU.',
    'Motor de riesgo: semáforo por SKU, día de quiebre y acción recomendada, con evaluación periódica y aviso por correo.',
    'Importación de OCs y parámetros por SKU desde CSV o Excel, con mapeo guardado por empresa.',
    'La recepción suma al inventario; configuración por empresa con 4 perfiles.',
  ]],
  ['Control Tower', [
    'Resumen con torre de control: SKU en riesgo, OC atrasadas, tareas del día y vencimientos.',
    'Tareas con responsable, comentarios y bitácora; excepciones con plazo, escalamiento y documentos faltantes.',
    'Checklist de documentos por envío con revisión y fechas de vencimiento.',
  ]],
  ['Operación logística', [
    'Envíos con tracking por hitos (Mongo) y tracking público por código de guía.',
    'Cotizaciones, reservas, tarifas, facturación, contenedores, navieras, almacén, flota, alertas y reportes.',
    'Notificaciones reales por correo y WhatsApp; API pública v1 con webhooks; formulario de contacto de la landing.',
    'Portal (proveedor y cliente final, con conversación), analítica por proveedor, prueba de entrega con recepción de la OC y seguimiento público con la marca de cada empresa.',
  ]],
  ['Seguridad y roles', [
    'Multi-tenant por fila, probado de punta a punta; login JWT con refresh y límite de peticiones.',
    'Segundo factor (Authenticator) con códigos de recuperación y bitácora de seguridad.',
    'Analista de SUTL con acceso explícito y revocable por empresa; proveedor y cliente final externos que solo ven lo suyo.',
  ]],
  ['Calidad', [
    '431 unitarias y 348 de punta a punta del backend, 67 de navegador en demo y 21 contra el backend real, todas en verde.',
    'CI, ADRs, documento de estado vivo, lint, tsc y build limpios; una base vacía migra completa.',
  ]],
];

const CODIGO_LISTO = [
  ['En construcción', [
    'Nada pendiente de probar: todo lo escrito hasta el 14 nov pasó sus pruebas.',
    'Siguiente módulo: metas de OTIF por empresa y exportación de la analítica; planes y pasarela (C5) esperan la cuenta de la pasarela.',
  ]],
];

const FALTA = [
  ['Entornos', [
    'Staging y producción en línea; hoy todo corre en local (D1, D2, D4).',
    'Observabilidad, backups con simulacro de restauración y pentest (D3, D5, D6).',
  ]],
  ['Producto', [
    'Metas de OTIF por empresa, exportación de la analítica y MFA obligatorio para administradores.',
    'Fechas de llegada para OC que todavía no viajan (B1b) y evidencia adjunta en tareas (B3).',
    'Exigir el segundo factor por política y mostrar el QR (C2).',
    'Firma en pantalla y fotos desde el celular (C6) y metas de OTIF por empresa.',
  ]],
  ['Negocio', [
    'Planes con pasarela de pago y facturación electrónica SRI (C5, C9).',
    'Entrevistas, design partners y piloto con un cliente real (E1–E3).',
    'Dirección de contacto real y credenciales de WhatsApp Cloud (A4, A11).',
  ]],
  ['Deuda técnica', [
    'Medir la cobertura ≥ 70% con las pruebas e2e (resto de A9).',
    'Protección de ramas en GitHub (A2).',
  ]],
];

const RIESGOS = [
  ['Probar tarde lo que se escribe', 'Esta semana se escribió código sin ejecutar el stack; al probarlo salió bien casi todo, pero apareció un defecto de fondo (las migraciones no reconstruían una base vacía) que llevaba semanas.', 'Probar con Docker al cerrar cada módulo grande, y la base vacía en CI.'],
  ['Entorno en línea sin definir', 'Sin staging no hay piloto con un cliente real; es la ruta crítica del cronograma.', 'Decidir nube y crear cuentas antes de la Sem 6 (13 nov). Propuesta: staging liviano primero, AWS completo después.'],
  ['Equipo de dos personas', 'Una ausencia detiene el avance (ya señalado en el Plan Maestro).', 'PRs pequeños, ADRs y documentación al día, revisión cruzada.'],
  ['Semanas con muchos frentes', 'Las Sem 6–8 y 19–22 concentran entre 5 y 6 tareas en paralelo; Navidad, Año Nuevo y Carnaval bajan la capacidad.', 'Estimaciones con ±1 semana de margen y las Fases A y B terminan antes de lo que exige el Plan Maestro; si algo se atrasa, se mueve primero C8 y C9, no las Fases A y B.'],
  ['Construir antes de validar', 'El Business Plan pide convertir al menos un piloto antes de ampliar el desarrollo.', 'El cronograma llega solo hasta el MVP + Control Tower. Lo que sigue queda tras la compuerta de validación (ver última página).'],
  ['SRI y pasarela de pago', 'Dependen de trámites externos (firma electrónica, ambiente de pruebas del SRI, cuenta de la pasarela).', 'Iniciar los trámites en la Sem 12, antes de programar.'],
  ['ERPs distintos en cada cliente', 'Cada ERP exporta distinto; un conector por cliente no escala.', 'Primero Excel/CSV con mapeo por empresa y API pública; conectores específicos solo bajo cotización, tras el piloto.'],
  ['Deuda de dependencias', 'Vulnerabilidades de npm audit exigen subir NestJS a v12 y Next a v16.', 'Tarea A9 en las Sem 8–9, tras A13 para tener las pruebas completas como red de seguridad; necesita tu aprobación.'],
];

const DECISIONES = [
  ['Nube: cuándo y dónde', 'Staging liviano (Supabase + Atlas + Vercel + host de contenedores) y AWS completo solo para producción, o AWS desde el inicio. Sigue sin decidirse y es la ruta crítica.', 'Sem 7 · 20 nov'],
  ['Dirección real del formulario de contacto', 'El formulario ya está escrito: falta la dirección de correo que lo recibe (CONTACT_INBOX_EMAIL) y si además va un botón de WhatsApp.', 'Sem 7 · 20 nov'],
  ['Subir NestJS 10→12 y Next 14→16', 'Cierra las vulnerabilidades conocidas pero puede romper código; se hace después de A13, con las pruebas completas.', 'Sem 8 · 27 nov'],
  ['WhatsApp y canal por empresa', 'Credenciales y plantillas de WhatsApp Cloud, y qué canal de aviso usa cada empresa.', 'Sem 8 · 27 nov'],
  ['Vertical del primer design partner', 'Agro y alimentos o manufactura (el Business Plan sugiere uno de los dos; pharma queda para después por ARCSA).', 'Sem 9 · 4 dic'],
  ['Avance de las entrevistas', 'No tengo información de cuántas entrevistas van; confirma para ajustar E1 y E2.', 'Sem 7 · 20 nov'],
  ['Horas semanales del dev de apoyo', 'Para calibrar cuánto de cada tarea se reparte a «Dev» sin cargar de más a una persona.', 'Sem 7 · 20 nov'],
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

// Lo avanzado en la semana 6 (9–14 nov).
const LOGROS_SEMANA = [
  ['Redis + BullMQ, pruebas contra el backend real y de accesibilidad, e importación desde Excel', 'A7, A8, A12'],
  ['Motor de riesgo de abastecimiento con semáforo y acción recomendada', 'B1'],
  ['Notificaciones reales por correo y WhatsApp con cola y reintentos', 'A11'],
  ['API pública y webhooks, evaluación periódica del riesgo y contacto de la landing', 'A10, B1b, A4'],
  ['Tareas y bitácora, excepciones con plazo, torre de control, segundo factor y bitácora de seguridad', 'B3, B4, B2, C2'],
  ['Checklist de documentos y vencimientos; roles de analista y proveedor', 'C1, B5'],
  ['Portal colaborativo: proveedor y cliente final con su portal, conversación y confirmación; cierra el hueco de que un cliente final veía todos los envíos', 'C3'],
  ['Analítica de abastecimiento: OTIF, lead time, atrasos y cumplimiento por proveedor', 'C4'],
  ['Seguimiento público con la marca de cada empresa; se cerró una fuga de correos internos en esa ruta', 'C8'],
  ['Prueba de entrega con evidencia y recepción de la OC desde la entrega', 'C6'],
  ['Seguimiento en vivo y mapa del recorrido, sin dependencias nuevas', 'C7'],
  ['Documentos compartidos con el cliente final y los proveedores (suben y ven lo suyo)', 'C3'],
  ['Todo lo anterior probado con el stack completo: 11 migraciones, 348 e2e, 67 + 21 de navegador y 431 unitarias en verde', 'A13'],
  ['Corregido: una base vacía no podía migrar (faltaban las tablas base); ahora sí, con una migración puente', 'defecto'],
];

// Qué cambió respecto de la versión anterior del cronograma.
const CAMBIOS = [
  'A4, A10, B1b, B2, B3, B4, B5, C1 y C2 pasan de «Código listo» a «Hecho»: se probaron con el stack completo (A13). C3 (portal), C4 (analítica), C8 (seguimiento con marca) C6 (prueba de entrega) y C7 (tiempo real y mapa) se construyeron y probaron entre el 14 y el 17 de noviembre.',
  'La Fase B termina en la semana 6, con unas 6 semanas de adelanto sobre lo planeado; el hito H3 queda con mucho colchón.',
  'Esa holgura se usa para adelantar la Fase C (portal, analítica, planes). El orden sigue lo que más pesa para el piloto: C3, C4 y luego C5–C7.',
  'Los hitos del Plan Maestro no se mueven. Lo que no se adelanta por falta de decisión de Kevin: nube (D1) y trámites externos (SRI, pasarela).',
];

// Plan de la semana 7 (16–20 nov): qué, quién y cuándo se da por hecho.
const PLAN_SEMANA = [
  { id: 'D1', titulo: 'Decidir la nube y crear las cuentas', resp: 'Kevin', hecho: 'Decisión tomada (staging liviano o AWS) y cuentas creadas.', nota: 'Ruta crítica: sin staging no hay piloto con un cliente real. Sigue sin decidirse.', decision: true },
  { id: 'C4b', titulo: 'Metas de OTIF por empresa y exportación de la analítica', resp: 'Dev', hecho: 'Cada empresa fija su meta de OTIF y puede descargar la analítica en Excel.', nota: 'Siguiente módulo tras C3.' },
  { id: 'A9', titulo: 'Deuda técnica: cobertura y subida de versiones', resp: 'Dev', hecho: 'Cobertura medida (meta ≥ 70%) y plan de la subida de NestJS y Next listo para tu aprobación.', nota: 'La subida en sí necesita tu aprobación.' },
  { id: 'A4', titulo: 'Dirección real del formulario de contacto', resp: 'Kevin', hecho: 'CONTACT_INBOX_EMAIL definido y decidido si va botón de WhatsApp.', nota: 'El formulario ya funciona.', decision: true },
  { id: 'A2', titulo: 'Activar la protección de ramas en GitHub', resp: 'Kevin', hecho: 'main y develop protegidas (PR con CI en verde y 1 aprobación) y develop creada.', nota: '15 min en Settings → Branches; pasos en docs/CONTRIBUTING.md.' },
  { id: 'E1', titulo: 'Entrevistas con el cliente ideal (sigue)', resp: 'Kevin', hecho: 'Avance confirmado y lista de candidatos a design partner.', nota: 'No tengo datos de cuántas llevas.' },
];

// Indicadores de la primera página. Actualizar a mano en cada corte (los de pruebas vienen de correr las suites).
const KPIS = [
  { n: '33', t: 'módulos de backend (Postgres, Mongo y Redis), todos probados con el stack completo' },
  { n: '867', t: 'pruebas en verde: 431 unitarias y 348 de punta a punta del backend, 67 de navegador en demo y 21 contra el backend real' },
  { n: '29', t: 'secciones del panel (algunas solo para un rol), más landing, login, tracking público y modo demo' },
  { n: 'Local', t: 'único entorno activo; staging y producción siguen sin desplegarse', color: 'red' },
];

const URGENTE = {
  titulo: 'Lo urgente de la próxima semana (16–20 nov):',
  items: [
    '<b>Decidir dónde vive el staging</b> (D1): es la ruta crítica para hacer un piloto con un cliente real.',
    '<b>Aprobar o no</b> la subida de NestJS 10→12 y Next 14→16 (A9), ahora con la suite completa como red de seguridad.',
    '<b>Dar la dirección real</b> del formulario de contacto (A4) y activar la protección de ramas en GitHub (A2, 15 min).',
  ],
};

module.exports = {
  TOTAL_WEEKS, TODAY_WEEK, NEXT_WEEK, CORTE, KPIS, URGENTE, CODIGO_LISTO, LOGROS_SEMANA, CAMBIOS, PLAN_SEMANA, MONTHS_HEADER, MILESTONES, PHASES, COVERAGE, YA_FUNCIONA, FALTA, RIESGOS, DECISIONES, HORIZONTE,
  weekStart, fmt, semanas, fechas, addDays,
};
