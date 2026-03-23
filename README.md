# Waybill System

Operational waybill, rider, shift, proof-of-delivery, billing, and invoice automation system for field delivery teams.

## What This Repo Contains

- [apps/frontend](/home/bernard/Work/way-bills/apps/frontend): React/Vite operations UI
- [apps/backend](/home/bernard/Work/way-bills/apps/backend): Hono API, worker, migrations, PDF generation, email delivery
- [deploy](/home/bernard/Work/way-bills/deploy): Docker, VPS, Caddy, backup, and deployment helpers
- [docs](/home/bernard/Work/way-bills/docs): product, architecture, and operations documentation

## System At A Glance

The platform supports:

- rider-led waybill creation and batch dispatch
- recipient proof of delivery with signature capture
- historical/manual delivery backfill with receipt-photo evidence
- rider shift check-in, checkout, and handover trail
- weekly billing and invoice generation
- automatic invoice email sending
- in-app notifications for handovers, failed deliveries, and invoice events

## Architecture

Start here for the top-level view:

- [Architecture Overview](/home/bernard/Work/way-bills/docs/architecture.md)

Deployment and operations:

- [Deployment Guide](/home/bernard/Work/way-bills/deploy/README.md)
- [Operations Runbook](/home/bernard/Work/way-bills/docs/ops-runbook.md)
- [Role Guide](/home/bernard/Work/way-bills/docs/role-guide.md)
- [API Reference](/home/bernard/Work/way-bills/docs/api-reference.md)

## Workspace Commands

Install dependencies from the repo root:

```bash
bun install
```

Run the frontend and backend locally:

```bash
bun run dev
```

Useful root commands:

```bash
bun run dev
bun run build:frontend
bun run test:backend
bun run typecheck:backend
bun run typecheck:frontend
```

Useful workspace commands:

```bash
bun run --cwd apps/backend test
bun run --cwd apps/backend db:migrate
bun run --cwd apps/frontend test
bun run --cwd apps/frontend build
```

## Local Preview

For a Docker-based local stack:

```bash
cp deploy/backend.local.env.example deploy/backend.local.env
cp deploy/compose.local.env.example deploy/compose.local.env
bash deploy/local-preview.sh up
```

That gives you:

- frontend: `http://localhost:3000`
- backend: `http://localhost:3001`
- local Postgres: `127.0.0.1:54329`

## Production Shape

Production is designed for:

- Docker Compose on your VPS
- host-level Caddy as the public reverse proxy
- PostgreSQL on the VPS or reachable over Docker networking
- Cloudflare R2 for uploads and generated document storage
- a separate `backend-worker` service for invoice automation

## Main Runtime Components

- `frontend`: user interface for admin, ops, and riders
- `backend`: authenticated API for waybills, shifts, billing, PDFs, notifications, and users
- `backend-worker`: scheduled invoice generation and automatic email sending
- `postgres`: primary relational datastore
- `r2`: object storage for receipts, signatures, profile images, and PDFs

## Important Notes

- database migrations live under [apps/backend/drizzle](/home/bernard/Work/way-bills/apps/backend/drizzle)
- invoice automation and email delivery depend on backend env configuration
- notifications, worker health, and automation monitor depend on the latest schema

If you are setting up or updating the system, apply migrations after pulling new changes:

```bash
bun run --cwd apps/backend db:migrate
```
