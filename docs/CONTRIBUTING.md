# Cómo trabajamos en el repositorio

Flujo definido en el Plan Maestro v1.0. Hoy se commitea directo a `main`; esta guía deja listo el flujo con PRs y falta **activar la protección en GitHub** (pasos abajo, solo el dueño del repo puede hacerlo).

## Ramas

| Rama | Para qué |
|---|---|
| `main` | Producción. Protegida: solo entra código por PR con CI en verde y aprobación. |
| `develop` | Integración. Cada merge a `develop` desplegará a Staging cuando exista. |
| `feature/<id>-<nombre>` | Trabajo nuevo (el `<id>` es el de la tarea del cronograma, ej. `feature/A1-vinculo-oc-embarque`). |
| `fix/<id>-<nombre>` / `hotfix/<id>-<nombre>` | Correcciones; un `hotfix` sale de `main`. |

## Cambios

1. Crear la rama desde `develop` (o `main` para un hotfix).
2. PRs **pequeños** (una tarea o parte de una). Al abrirlo se carga la plantilla con la lista de verificación.
3. El CI debe quedar en verde: lint, `tsc`, build, pruebas unitarias y e2e contra Postgres y Mongo reales, y Playwright del frontend.
4. Revisión cruzada: nadie aprueba su propio PR.
5. Commits en español con prefijo (`feat:`, `fix:`, `docs:`…) y un cuerpo que explique el porqué.

## Activar la protección de ramas (una sola vez, en GitHub)

`Settings → Branches → Add branch ruleset` (o *Add rule*) para `main`, y lo mismo para `develop`:

- **Require a pull request before merging**, con 1 aprobación y *Require review from Code Owners*.
- **Require status checks to pass**: `backend` y `frontend` (los dos jobs de `CI`), con *Require branches to be up to date*.
- **Block force pushes** y **Restrict deletions**.
- Crear la rama `develop` a partir de `main` si todavía no existe.

Mientras esto no esté activo, el CI solo detecta: un push directo a `main` se sube igual aunque el CI falle.

## Antes de abrir un PR

```bash
# backend
cd backend && npm run lint && npx tsc --noEmit && npm test && npm run test:e2e
# frontend
cd frontend && npm run lint && npm run test:unit && npm run test:e2e
```

Las pruebas e2e del backend necesitan Postgres y Mongo (`docker compose up -d postgres mongo`). Las de Playwright levantan su propio servidor en modo demo en el puerto 3002: detén antes el `npm run dev` del frontend si lo tienes corriendo.

## Decisiones de arquitectura

Están en `docs/adr/`. Antes de cambiar una, escribe un ADR nuevo que la reemplace.
