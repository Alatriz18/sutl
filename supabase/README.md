# Supabase — base de datos inicial de SUTL

Fase 1 usa **Supabase** (Postgres gestionado, plan free) como `DATABASE_URL` de Prisma. Es un Postgres estándar: migrar a **AWS RDS Aurora** en el futuro es solo cambiar la connection string, sin tocar el schema ni el código.

## Setup rápido

1. Crear proyecto en [supabase.com](https://supabase.com) (plan free).
2. En **Project Settings → Database → Connection string**, copiar la URI en modo **Connection Pooling (Transaction)** para runtime y la **Direct connection** para migraciones.
3. En `backend/.env`:
   ```
   DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true"
   DIRECT_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"
   ```
   (`DIRECT_URL` ya está referenciado en `backend/prisma/schema.prisma` para que `prisma migrate` no falle por el pgbouncer del pooler).
4. Aplicar el schema:
   ```bash
   cd backend
   npm install
   npm run prisma:migrate -- --name init
   npm run prisma:seed
   ```
   Esto crea las tablas y usuarios demo (ver `backend/prisma/seed.ts`).

Alternativa manual: pegar `supabase/schema.sql` en el SQL Editor de Supabase (sin correr `prisma migrate`) — útil si solo quieres inspeccionar el modelo sin Node instalado. En ese caso, correr luego `npx prisma migrate resolve --applied init` para que Prisma no intente re-crear las tablas.

## Por qué no usamos supabase-js ni RLS

El backend NestJS habla con Postgres directamente vía Prisma (`DATABASE_URL`), no a través del cliente `supabase-js` desde el navegador. El aislamiento multi-tenant se hace en la capa de aplicación (`tenantId` del JWT en cada query — ver `CLAUDE.md`), así que **Row Level Security no está activado**. Si en una fase posterior se decide exponer Supabase directamente al frontend (auth de Supabase, realtime, etc.), activar RLS por `tenant_id` en cada tabla antes de hacerlo.

## MongoDB Atlas (tracking-events)

Los eventos de tracking no van en Supabase — viven en MongoDB Atlas (free tier M0). Crear cluster, usuario de DB y agregar la URI a `backend/.env` como `MONGO_URI`. Ver `docs/ARQUITECTURA.md`.
