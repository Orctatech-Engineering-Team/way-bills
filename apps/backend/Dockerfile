FROM oven/bun:1.3.10 AS deps

WORKDIR /app

COPY bun.lock package.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json

RUN bun install --frozen-lockfile --production

FROM oven/bun:1.3.10 AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/bun.lock ./bun.lock
COPY --from=deps /app/apps/backend/package.json ./apps/backend/package.json
COPY apps/backend/src ./apps/backend/src
COPY apps/backend/drizzle ./apps/backend/drizzle
COPY apps/backend/drizzle.config.ts ./apps/backend/drizzle.config.ts

WORKDIR /app

EXPOSE 3001

CMD ["bun", "run", "--cwd", "apps/backend", "start"]
