FROM oven/bun:1.3.10 AS app

WORKDIR /app

COPY . .

RUN bun install --frozen-lockfile

WORKDIR /app/apps/backend

EXPOSE 3001

CMD ["bun", "run", "start"]

