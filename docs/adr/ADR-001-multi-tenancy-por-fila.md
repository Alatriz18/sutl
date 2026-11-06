# ADR-001 — Multi-tenancy por fila compartida con `tenantId`

- **Estado**: aceptada (vigente desde la Fase 1)
- **Fecha**: 2026-11-06 (registra una decisión tomada en la Fase 1)

## Contexto

SUTL es una plataforma SaaS: muchas empresas (tenants) comparten la misma instalación y ninguna puede ver ni modificar datos de otra. Una fuga entre empresas es el riesgo crítico del producto (lo señala el Plan Maestro). Hay que elegir cómo aislar los datos.

## Decisión

Un solo esquema de base de datos. **Toda tabla de negocio tiene `tenantId` obligatorio** y toda consulta lo filtra. El `tenantId` sale **siempre del JWT** del usuario autenticado, nunca de un parámetro ni del body.

Reglas que se derivan y que el código ya aplica:

1. **Lecturas**: `findFirst({ where: { id, tenantId } })`, nunca `findUnique({ id })` sobre datos de negocio.
2. **Escrituras**: el `where` del `update`/`delete` real repite el `tenantId`; no basta con haber verificado antes.
3. **Referencias en el body** (`clienteId`, `shipmentId`, `userId`…): Prisma solo valida que el ID exista, no de quién es. Se valida con `assertTenantRefs` (`backend/src/common/tenant-refs.ts`), que responde 404 igual que para un ID inexistente, para no revelar si el ID existe en otra empresa.
4. **Catálogos globales** (`Carrier`) no llevan `tenantId`: solo se valida que existan. Las tarifas globales se leen pero no se escriben desde un tenant.
5. **Tablas hijas sin `tenantId` propio** (ej. `WarehouseLocation`) heredan la pertenencia por su padre y siempre se consultan a través de él.
6. **`super_admin`** es el único rol que cruza tenants, de forma explícita y solo en el panel SaaS; un `admin_tenant` no puede crear ni ascender a nadie a `super_admin`.
7. **Cada módulo nuevo** trae una prueba e2e que demuestra el aislamiento con dos empresas reales (ver `backend/test/tenant-isolation-*.e2e-spec.ts` y las pruebas de cada módulo).

## Consecuencias

- (+) Operación simple: un solo despliegue, migraciones y backups únicos, costo bajo en la etapa inicial.
- (+) El aislamiento es verificable con pruebas automáticas contra Postgres real.
- (−) El aislamiento depende de la disciplina del código: un `where` sin `tenantId` es una fuga. Por eso las reglas anteriores son obligatorias en revisión de PR y cada módulo exige su prueba de aislamiento.
- (−) No hay aislamiento físico: un cliente grande que lo exija requeriría otra solución (ver alternativas).

## Alternativas descartadas

- **Esquema por tenant**: aislamiento más fuerte, pero migraciones por cada empresa, más conexiones y operación compleja para una etapa con pocos clientes. Se puede reevaluar para un cliente que lo exija contractualmente.
- **Base de datos por tenant**: máximo aislamiento, costo y operación desproporcionados hoy.
- **Row-Level Security de Postgres**: una segunda línea de defensa valiosa; queda como mejora futura (activarla no reemplaza las reglas de arriba).
