# Backend

This workspace contains the Hono API, background worker, migrations, PDF generation, notification logic, and invoice automation for the Waybill System.

## Main Responsibilities

- authentication and session cookies
- user, rider, and client management
- waybill lifecycle rules
- proof-of-delivery creation
- shift and handover audit trail
- reports and billing
- invoice generation and email delivery
- notification generation
- file storage via Cloudflare R2

## Main Entry Points

- API server: [src/index.ts](/home/bernard/Work/way-bills/apps/backend/src/index.ts)
- worker: [src/worker.ts](/home/bernard/Work/way-bills/apps/backend/src/worker.ts)
- worker health: [src/worker-health.ts](/home/bernard/Work/way-bills/apps/backend/src/worker-health.ts)
- schema: [src/db/schema.ts](/home/bernard/Work/way-bills/apps/backend/src/db/schema.ts)

## Commands

From the repo root:

```bash
bun run --cwd apps/backend dev
bun run --cwd apps/backend test
bun run --cwd apps/backend typecheck
bun run --cwd apps/backend build
bun run --cwd apps/backend db:generate
bun run --cwd apps/backend db:migrate
```

## Important Folders

- `src/routes`: API route handlers
- `src/lib`: business logic and helpers
- `src/db`: DB client, schema, seed, admin bootstrap
- `drizzle`: generated SQL migrations and metadata

## Related Docs

- [Root README](/home/bernard/Work/way-bills/README.md)
- [Architecture Overview](/home/bernard/Work/way-bills/docs/architecture.md)
- [Deployment Guide](/home/bernard/Work/way-bills/deploy/README.md)
