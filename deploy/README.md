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

## Run database migrations

```bash
docker compose --env-file deploy/compose.env -f deploy/docker-compose.yml run --rm backend bun run db:migrate
```

## Optional seed

```bash
docker compose --env-file deploy/compose.env -f deploy/docker-compose.yml run --rm backend bun run db:seed
```

## Helper script

`deploy/deploy.sh` wraps the common deployment tasks:

- `bash deploy/deploy.sh up`: build, start, and migrate
- `bash deploy/deploy.sh migrate`: run migrations only
- `bash deploy/deploy.sh seed`: run seed data
- `bash deploy/deploy.sh logs`: tail service logs
- `bash deploy/deploy.sh pull-up`: pull images, restart, and migrate

## Notes

- The frontend is built with `VITE_API_BASE_URL=https://api.waybills.orctatech.com`, so browser requests go directly to the API domain.
- The frontend container also uses Caddy internally as a simple static file server for the built SPA.
- Docker publishes the services only on `127.0.0.1`, so host Caddy can reach them while they stay off the public interface.
- `APP_ORIGIN` in `backend.env` must match the frontend origin, which is `https://waybills.orctatech.com`.
- The backend joins `orcta_net` only so it can reach a PostgreSQL service there; host Caddy does not need that network.
- Caddy should remain the public entry point.
