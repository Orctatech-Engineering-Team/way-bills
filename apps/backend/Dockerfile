# syntax=docker/dockerfile:1.7

FROM oven/bun:1.3.10 AS deps

WORKDIR /app

COPY bun.lock package.json ./
COPY apps/backend/package.json apps/backend/package.json

RUN --mount=type=cache,target=/root/.bun/install/cache \
  bun install --cwd apps/backend

FROM deps AS builder

WORKDIR /app

COPY apps/backend/src ./apps/backend/src

RUN bun run --cwd apps/backend build

FROM oven/bun:1.3.10 AS ops

WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules
COPY apps/backend/src ./apps/backend/src
COPY apps/backend/drizzle ./apps/backend/drizzle
COPY apps/backend/drizzle.config.ts ./apps/backend/drizzle.config.ts

WORKDIR /app

USER bun

CMD ["bun", "--version"]

FROM oven/bun:1.3.10 AS runtime

WORKDIR /app

ENV NODE_ENV=production

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/apps/backend/dist ./apps/backend/dist

WORKDIR /app

USER bun

EXPOSE 3001

CMD ["bun", "apps/backend/dist/index.js"]
