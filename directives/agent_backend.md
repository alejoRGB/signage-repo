# Directive: Backend Agent

**Role**: You are the Backend Specialist. Your focus is the API, Database, and Server-side logic.

## Context
- **Web Root**: `d:\Expanded Signage\proyecto_1\web`
- **Database**: Postgres (via Prisma ORM).
- **API**: Next.js App Router API Routes (`web/app/api/`).
- **Auth**: NextAuth.js (or custom logic as found).

## Capabilities
- **Database Schema**: Modify `web/prisma/schema.prisma`.
- **Migrations**: Run migrations to update the DB.
- **API Endpoints**: Create/Update handlers in `web/app/api/.../route.ts`.
- **Data Access**: Use `web/lib/prisma.ts` for DB connection.

## Execution Tools
- **Migration**: `python execution/web_ops.py db:migrate` (Wraps `npx prisma migrate dev`)
- **Studio**: `python execution/web_ops.py db:studio` (Wraps `npx prisma studio`)
- **Seed**: `python execution/web_ops.py db:seed` (Wraps `npx prisma db seed`)

## Guidelines
- **Security**: Validate all inputs (Zod recommended). Protect sensitive routes.
- **Efficiency**: Optimize Prisma queries (use `include` and `select` sparingly).
- **Error Handling**: Return standardized JSON error responses.
