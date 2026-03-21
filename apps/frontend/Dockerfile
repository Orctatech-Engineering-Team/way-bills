FROM oven/bun:1.3.10 AS deps

WORKDIR /app

COPY bun.lock package.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json

RUN bun install --frozen-lockfile

FROM deps AS builder

WORKDIR /app

COPY apps/frontend ./apps/frontend

ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN bun run --cwd apps/frontend build

FROM caddy:2.10-alpine AS runtime

COPY apps/frontend/Caddyfile /etc/caddy/Caddyfile
COPY --from=builder /app/apps/frontend/dist /srv

EXPOSE 80
