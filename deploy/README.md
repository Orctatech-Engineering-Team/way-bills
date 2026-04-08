# Deployment

This stack assumes:

- Docker and Docker Compose on your VPS
- a Caddy instance running directly on the VPS handling public TLS and proxying to these services
- an existing external Docker network named `orcta_net` if your PostgreSQL service is only reachable on that network
- PostgreSQL running on your VPS or reachable from it
- Cloudflare R2 for file storage

## Files

- `docker-compose.yml`: app stack
- `backend.env.example`: backend runtime environment
- `compose.env.example`: Compose-time variables
- `Caddyfile.example`: example host Caddy routes for the frontend and API domains

The backend Docker build is split into:

- a lean `runtime` image for the API service
- a separate `ops` image for migrations, seed data, and admin bootstrap tasks
- a `backend-worker` service in Compose for scheduled invoice automation

## First-time setup

1. If your PostgreSQL service is on Docker and reachable through `orcta_net`, make sure that network exists:

```bash
docker network create orcta_net
```

2. Copy the env files and fill them in:

```bash
cp deploy/backend.env.example deploy/backend.env
cp deploy/compose.env.example deploy/compose.env
```

3. Add the routes from `deploy/Caddyfile.example` to your host Caddy config. They proxy:
- `waybills.orctatech.com` to the frontend loopback port
- `api.waybills.orctatech.com` to the backend loopback port

## Build and start

```bash
docker compose --env-file deploy/compose.env -f deploy/docker-compose.yml up -d --build
```

Or use the helper script:

```bash
bash deploy/deploy.sh up
```

## Local Docker preview

If you want to inspect changes locally before pushing, use the dedicated local preview stack:

```bash
cp deploy/backend.local.env.example deploy/backend.local.env
cp deploy/compose.local.env.example deploy/compose.local.env
bash deploy/local-preview.sh up
```

That gives you:

- frontend on `http://localhost:3000`
- backend on `http://localhost:3001`
- local PostgreSQL on `127.0.0.1:54329`

For a quick local login without demo seed data:

```bash
BOOTSTRAP_ADMIN_NAME="Admin User" \
BOOTSTRAP_ADMIN_PHONE="+233200000001" \
BOOTSTRAP_ADMIN_PASSWORD="ChangeMe123!" \
bash deploy/local-preview.sh bootstrap-admin
```

If you want the full demo dataset locally:

```bash
bash deploy/local-preview.sh seed
```

## Run database migrations

```bash
docker compose --env-file deploy/compose.env -f deploy/docker-compose.yml --profile ops run --rm backend-ops bun run --cwd apps/backend db:migrate
```

## Optional seed

```bash
docker compose --env-file deploy/compose.env -f deploy/docker-compose.yml --profile ops run --rm backend-ops bun run --cwd apps/backend db:seed
```

## Bootstrap the first admin

If you want production credentials without loading demo seed data, create the first admin like this:

```bash
BOOTSTRAP_ADMIN_NAME="Admin User" \
BOOTSTRAP_ADMIN_PHONE="+233200000001" \
BOOTSTRAP_ADMIN_PASSWORD="replace-with-a-strong-password" \
bash deploy/deploy.sh bootstrap-admin
```

This creates the admin if the phone does not exist yet, or refreshes the password and name if that phone already belongs to an admin account.

## Helper script

`deploy/deploy.sh` wraps the common deployment tasks:

- `bash deploy/deploy.sh up`: build, start, and migrate
- `bash deploy/deploy.sh migrate`: run migrations only
- `bash deploy/deploy.sh bootstrap-admin`: create or refresh the initial admin account
- `bash deploy/deploy.sh seed`: run seed data
- `bash deploy/deploy.sh logs`: tail service logs
- `bash deploy/deploy.sh pull-up`: pull images, restart, and migrate

The local preview helper mirrors the same flow:

- `bash deploy/local-preview.sh up`
- `bash deploy/local-preview.sh bootstrap-admin`
- `bash deploy/local-preview.sh seed`
- `bash deploy/local-preview.sh logs`
- `bash deploy/local-preview.sh down`

## Backups And Recovery

Operational backup and recovery guidance lives in:

- `docs/ops-runbook.md`

PostgreSQL helper scripts:

- `bash deploy/backup-postgres.sh`
- `bash deploy/restore-postgres.sh <backup.dump> --yes-i-understand`

## GitHub Actions

The repo includes a single CI/CD workflow at `.github/workflows/ci-cd.yml`.

- Pull requests run workspace verification and Docker image builds.
- Pushes to `main` run the same checks and then deploy to the VPS over SSH.

Set these GitHub secrets before enabling deployment:

- `VPS_HOST`
- `VPS_USER`
- `VPS_PORT`
- `VPS_SSH_KEY`
- `VPS_APP_DIR`

## Notes

- The frontend is built with `VITE_API_BASE_URL=https://api.waybills.orctatech.com`, so browser requests go directly to the API domain.
- The frontend container also uses Caddy internally as a simple static file server for the built SPA.
- Docker publishes the services only on `127.0.0.1`, so host Caddy can reach them while they stay off the public interface.
- `APP_ORIGIN` in `backend.env` must match the frontend origin, which is `https://waybills.orctatech.com`.
- The backend joins `orcta_net` only so it can reach a PostgreSQL service there; host Caddy does not need that network.
- The API service runs from the bundled backend runtime image; migrations and other operational commands run from the separate `backend-ops` image.
- The worker runs from the same bundled runtime image and is controlled with `INVOICE_AUTOMATION_ENABLED`, `INVOICE_AUTOMATION_INTERVAL_MINUTES`, `INVOICE_AUTOMATION_LOOKBACK_WEEKS`, and `AUTOMATION_ACTOR_PHONE`.
- Real invoice email delivery uses SMTP and requires `MAIL_ENABLED`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, and `MAIL_FROM`.
- The worker now has its own Docker healthcheck. It stays healthy when automation is disabled, when a sweep is actively running, or when recent worker activity is still fresh. It turns unhealthy if the worker stalls or if the last completed sweep failed and has not recovered.
- To inspect worker health in production:
  - `docker compose --env-file deploy/compose.env -f deploy/docker-compose.yml ps`
  - `docker compose --env-file deploy/compose.env -f deploy/docker-compose.yml logs -f backend-worker`
  - use the invoices page automation monitor for the latest run state, last error, and email sweep summary
- Caddy should remain the public entry point.
- Local Docker preview works without `orcta_net`; it uses its own Postgres service.
- Upload-dependent flows still need real R2 env values. If you leave the local R2 vars blank, the rest of the app can still be inspected, but media uploads and generated file storage will fail.
