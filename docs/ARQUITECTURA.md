# Arquitectura — SUTL (Fase 1)

## Multi-tenancy

Modelo elegido: **fila compartida con `tenant_id`** en cada tabla transaccional (Postgres) y cada documento (Mongo). Se descarta schema-per-tenant para la Fase 1 por simplicidad operativa; se puede reevaluar si un cliente grande exige aislamiento físico.

## Flujo de datos de tracking

```
Operador del tenant
   │  crea envío
   ▼
POST /api/shipments  ──────────►  PostgreSQL (Shipment)
   │
   │  registra eventos de estado/ubicación
   ▼
POST /api/tracking-events ─────►  MongoDB Atlas (TrackingEvent)
   │
   ▼
Cliente final consulta por código de guía
GET /api/shipments/:codigoGuia/tracking  (público, sin auth)
```

## Autenticación

- JWT access token (vida corta, ~15 min) + refresh token (vida larga, ~7 días) en cookie httpOnly.
- Cada token incluye `tenant_id` y `rol`.
- Guard global valida `tenant_id` en cada request autenticado; ningún query cruza tenants salvo para `super_admin` en el panel SaaS.

## Roles

| Rol | Alcance |
|---|---|
| `super_admin` | SVK Solutions — administra todos los tenants (panel SaaS, Fase 5) |
| `admin_tenant` | Administrador de la empresa logística suscrita |
| `operador` | Usuario operativo del tenant (crea envíos, registra eventos) |
| `cliente_final` | Solo lectura, acceso vía código de guía público (sin cuenta) |

## Por qué Postgres + Mongo

- **Postgres**: datos relacionales de negocio (tenants, usuarios, envíos) donde la integridad referencial importa.
- **MongoDB Atlas**: eventos de tracking son alta escritura, poco relacionales, y se benefician de un esquema flexible (distintos tipos de eventos según el proveedor logístico).

## Pendiente de decidir (Fase 1)

- Proveedor de mapas para el dashboard (Fase 3).
- Estrategia de notificaciones al cliente final (email vs SMS vs WhatsApp API).
- Estructura exacta de planes/facturación para el panel SaaS Admin (Fase 5).
