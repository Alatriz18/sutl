# SUTL — Sistema Universal de Tracking Logístico

Plataforma SaaS B2B de tracking logístico multi-tenant para Ecuador/LATAM.

Desarrollado por **SVK Solutions** — Kevin Santana
> "Si lo puedes imaginar, yo lo puedo programar"

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Frontend Web | Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui |
| Backend / API | Node.js + NestJS + REST API (JWT Auth) |
| Base de datos | PostgreSQL (datos transaccionales) + MongoDB Atlas (eventos de tracking / logs de alta escritura) |
| Infraestructura | Docker Compose (dev local), AWS RDS Aurora (prod), Vercel (frontend) |
| Seguridad | TLS 1.3, AES-256 en reposo, JWT + refresh tokens, arquitectura multi-tenant aislada, OWASP compliance |
| Móvil (fase futura) | React Native (Expo) — fuera del alcance de la Fase 1 |

## Estructura del monorepo

```
sutl/
├── backend/          # API NestJS
├── frontend/          # Next.js 14 App Router
├── docs/              # Documentación de arquitectura
├── docker-compose.yml
└── CLAUDE.md          # Contexto del proyecto para Claude Code
```

## Fases del proyecto (16 semanas)

- **F1 — Arquitectura** (semana actual): monorepo, Docker Compose, esquema de base de datos, módulo de autenticación multi-tenant, CI/CD base.
- **F2 — Backend & API**: módulos de tracking (envíos, eventos, estados), integraciones, webhooks.
- **F3 — Web App (Next.js)**: dashboard de cliente, seguimiento en tiempo real, mapas.
- **F5 — Panel SaaS Admin**: gestión de tenants, facturación, planes.
- **F6 — DevOps & Seguridad**: hardening, monitoreo, backups, despliegue AWS.
- **F7 — QA & Documentación**: pruebas end-to-end, documentación técnica y de usuario.

## Levantar el entorno de desarrollo

```powershell
# 1. Copiar variables de entorno
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 2. Levantar contenedores
docker compose up --build

# Backend:  http://localhost:3001
# Frontend: http://localhost:3000
```

## Próximo paso

Abrir esta carpeta en VS Code y pedirle a **Claude Code** que continúe con la Fase 1 usando `CLAUDE.md` como contexto inicial.
