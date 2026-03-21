# Deployment

This stack assumes:

- Docker and Docker Compose on your VPS
- an existing external Docker network named `orcta_net`
- a Caddy instance on that same network handling public TLS and proxying to these services
- PostgreSQL running on your VPS or reachable from it
- Cloudflare R2 for file storage

## Files

- `docker-compose.yml`: app stack
- `backend.env.example`: backend runtime environment
- `compose.env.example`: Compose-time variables
- `Caddyfile.example`: example Caddy route for the app domain

## First-time setup

1. Create the shared network if it does not already exist:

```bash
docker network create orcta_net
```

2. Copy the env files and fill them in:

```bash
cp deploy/backend.env.example deploy/backend.env
cp deploy/compose.env.example deploy/compose.env
```

3. Make sure your external Caddy is attached to `orcta_net` and add the route from `deploy/Caddyfile.example`.

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

- The frontend is built with `VITE_API_BASE_URL=/api`, so browser requests stay on the same origin and Caddy forwards `/api/*` to the backend.
- The frontend container also uses Caddy internally as a simple static file server for the built SPA.
- `APP_ORIGIN` in `backend.env` must match the public app URL.
- The backend and frontend are not published directly on host ports; Caddy should be the public entry point.
