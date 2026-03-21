FROM oven/bun:1.3.10 AS builder

WORKDIR /app

COPY . .

RUN bun install --frozen-lockfile

ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN bun run --cwd apps/frontend build

FROM caddy:2.10-alpine AS runtime

COPY apps/frontend/Caddyfile /etc/caddy/Caddyfile
COPY --from=builder /app/apps/frontend/dist /srv

EXPOSE 80
