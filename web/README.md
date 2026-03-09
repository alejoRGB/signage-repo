# Web Dashboard

Next.js dashboard and public marketing site for the Digital Signage system.

## What lives here

- Public marketing pages and SEO landing pages
- Authenticated dashboard for devices, media, playlists, schedules, and sync/videowall
- API routes used by the dashboard and Raspberry Pi players
- Prisma schema and database access layer

## Local setup

1. Install dependencies:
```bash
npm install
```
2. Create local env vars:
```bash
copy .env.example .env
```
3. Fill in the values required for your environment.
4. Start the app:
```bash
npm run dev
```

The app runs on `http://localhost:3000`.

## Required environment variables

These must exist for normal local development:

- `DATABASE_URL`
- `DATABASE_URL_UNPOOLED`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_APP_URL`
- `INTERNAL_WORKER_SECRET`

Common optional groups already documented in [.env.example](./.env.example):

- Contact delivery and webhook retry settings
- Upstash rate limiting
- Media upload reconciliation
- Debug API toggles
- E2E credentials and target URL

## Useful commands

```bash
npm run dev
npm run lint
npm run build
npm run test:api
npm run test:ui
npm run test:e2e
```

## Validation expectations

Before deploy, this package should pass:

- `npm run lint`
- `npm run build`
- `npm run test:api`
- `npm run test:ui`
- `npm run test:e2e`

`test:e2e` delegates to the local Playwright smoke suite in `../qa_automation`.

## Test scope

- `test:api`: Jest tests for API routes and server-side helpers
- `test:ui`: Vitest component tests
- `test:e2e`: local Playwright smoke against a dev server

Remote Playwright suites and visual captures stay in `../qa_automation` and require explicit environment variables.

## Notes

- Media currently used in a playlist cannot be deleted.
- `DATABASE_URL` should point to the pooled/runtime database URL when available.
- `DATABASE_URL_UNPOOLED` should point to the direct Prisma migrate/introspection URL.
