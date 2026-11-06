# ADR-003 — Configuración de la operación por empresa (perfil + ajustes)

- **Estado**: aceptada
- **Fecha**: 2026-11-06 (decisión del 2026-11-03)

## Contexto

SUTL se vende a industrias distintas (manufactura, comercio, empresas con ERP propio). Una misma regla no sirve para todas: unas quieren que recibir una OC mueva inventario y otras llevan el stock en su ERP; unas aceptan recibir un 5 % de más en granel y otras exactamente lo pedido. Fijar estas reglas en el código obliga a bifurcar el producto por cliente.

## Decisión

Las reglas de negocio que varían entre clientes **no se fijan en el código: se leen de la configuración de la empresa**.

- Un **perfil de industria** (`general`, `manufactura`, `comercio`, `erp_externo`) trae valores sugeridos.
- La empresa guarda **solo los ajustes que cambió** encima del perfil (`Tenant.configuracion`, JSON; `Tenant.perfilOperacion`). Un ajuste nuevo que se agregue después toma el valor del perfil sin migrar datos.
- La configuración efectiva = perfil + ajustes (`resolverConfig`). Lo guardado se lee de forma defensiva: se descartan claves desconocidas y tipos incorrectos.
- **La regla la aplica el backend**, siempre. Un interruptor que solo existe en la pantalla no cumple esta decisión. Si un pedido contradice la configuración, se rechaza con un 400 explicativo en vez de ignorarse en silencio.
- Solo `admin_tenant` y `super_admin` la cambian; los operadores la leen para que la web adapte sus formularios.
- Siempre actúa sobre el tenant del JWT, nunca por parámetro.

Para agregar un ajuste: valor por perfil en `tenant-config.defaults.ts` + validación en el DTO + control en `/dashboard/configuracion` + aplicarlo en el servicio que corresponda + copia en el modo demo (`frontend/src/lib/mock/tenant-config.ts`) + prueba e2e del efecto real.

Ajustes actuales: tolerancia de sobre-recepción, días de alerta anticipada de OCs, fecha de confirmación obligatoria, si vincular un embarque despacha la OC, si la recepción de OC actualiza el inventario (siempre / a elección / nunca) y los días de cobertura que disparan la alerta de inventario.

## Consecuencias

- (+) Un solo producto sirve a industrias distintas y a empresas con ERP propio; el onboarding es elegir un perfil y afinar.
- (+) Cada ajuste queda cubierto por una prueba que demuestra su efecto real.
- (−) Cada ajuste nuevo suma superficie (perfil, DTO, pantalla, demo, prueba) y combinaciones a probar. Se agregan solo cuando un cliente real lo necesita, no por anticipado.
- (−) Con JSON en una columna no se puede consultar por ajuste con SQL simple; hoy no hace falta.

## Alternativas descartadas

- **Reglas fijas en el código**: obliga a una bifurcación por cliente.
- **Una tabla de configuración por módulo**: más rígida; cada ajuste nuevo exigiría una migración.
- **Feature flags de un servicio externo**: sirven para activar funciones, no para parametrizar reglas de negocio por cliente.
