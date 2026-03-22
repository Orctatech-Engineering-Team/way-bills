FROM oven/bun:1.3.10 AS deps

WORKDIR /app

COPY bun.lock package.json ./
COPY apps/backend/package.json apps/backend/package.json

RUN bun install --cwd apps/backend

FROM oven/bun:1.3.10 AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules
COPY apps/backend/src ./apps/backend/src
COPY apps/backend/drizzle ./apps/backend/drizzle
COPY apps/backend/drizzle.config.ts ./apps/backend/drizzle.config.ts

WORKDIR /app

EXPOSE 3001

CMD ["bun", "run", "--cwd", "apps/backend", "start"]
