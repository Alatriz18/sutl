## Qué cambia y por qué

<!-- Una o dos frases. Si cierra una tarea del cronograma, indica su ID (ej. A1). -->

## Checklist (Definición de Hecho)

- [ ] CI en verde (lint, build, pruebas unitarias y e2e).
- [ ] **Aislamiento multi-tenant**: toda consulta nueva filtra por `tenantId` del JWT y las referencias del body se validan con `assertTenantRefs` (ver `docs/adr/ADR-001-multi-tenancy-por-fila.md`).
- [ ] Hay una prueba e2e que demuestra el aislamiento con dos empresas (si toca datos de negocio).
- [ ] Si la regla puede variar entre clientes, es un **ajuste de configuración por empresa**, no un valor fijo (ver ADR-003).
- [ ] DTOs validados con `class-validator`; sin credenciales ni cadenas de conexión en el código (todo en `.env`).
- [ ] Migración de Prisma incluida si cambia el esquema.
- [ ] Modo demo del frontend al día si cambia la API.
- [ ] `docs/ESTADO_PROYECTO.md` actualizado con el cambio.

## Cómo probarlo

<!-- Pasos o comandos para verificar el cambio. -->
