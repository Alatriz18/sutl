# ADR-002 — PostgreSQL para lo transaccional y MongoDB para eventos de tracking

- **Estado**: aceptada (vigente desde la Fase 1)
- **Fecha**: 2026-11-06 (registra una decisión tomada en la Fase 1)

## Contexto

SUTL guarda dos tipos de datos con necesidades distintas:

- **Transaccionales y relacionales**: empresas, usuarios, envíos, OCs, inventario, facturación. Necesitan integridad referencial, transacciones y consultas con joins.
- **Eventos de tracking**: histórico de estados y posiciones de cada guía. Es de **alta escritura**, solo se agrega, y se consulta casi siempre por guía.

## Decisión

- **PostgreSQL con Prisma** para todo lo transaccional. En producción, Aurora (RDS).
- **MongoDB (Atlas) con Mongoose** solo para los eventos de tracking (`tracking-events`).

El estado actual de un envío vive en Postgres (`Shipment.estado`) y se actualiza con el último evento registrado; el histórico completo vive en Mongo. Los eventos llevan `tenantId` y se filtran igual que cualquier dato de negocio (ver ADR-001).

## Consecuencias

- (+) Cada motor hace lo que mejor sabe: integridad y transacciones en Postgres (las recepciones de OC, por ejemplo, sumar inventario y cerrar la OC en una sola transacción); escritura masiva de eventos en Mongo.
- (+) El histórico de eventos puede crecer sin cargar la base transaccional.
- (−) Dos motores que operar, respaldar y asegurar.
- (−) No hay transacción entre ambos: registrar un evento y actualizar el estado del envío no es atómico. Se acepta porque el evento es la fuente del histórico y el estado es derivado; si falla el segundo paso, el siguiente evento lo corrige.
- (−) Regla práctica: **nada nuevo de negocio va a Mongo** salvo que sea del mismo tipo (series de eventos de alta escritura). Lo demás es Postgres.

## Alternativas descartadas

- **Solo Postgres**: más simple de operar; los eventos cabrían en una tabla particionada. Se descartó por el volumen esperado de eventos y para no cargar la base transaccional. Es la alternativa a reevaluar si operar dos motores resulta costoso.
- **Solo Mongo**: pierde integridad referencial y transacciones, que el negocio necesita (inventario, facturación, OCs).
