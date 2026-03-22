#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.yml"
COMPOSE_ENV_FILE="${SCRIPT_DIR}/compose.env"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required but not installed." >&2
  exit 1
fi

if [[ ! -f "${COMPOSE_ENV_FILE}" ]]; then
  echo "Missing ${COMPOSE_ENV_FILE}. Copy deploy/compose.env.example first." >&2
  exit 1
fi

if [[ ! -f "${SCRIPT_DIR}/backend.env" ]]; then
  echo "Missing ${SCRIPT_DIR}/backend.env. Copy deploy/backend.env.example first." >&2
  exit 1
fi

compose() {
  (
    cd "${REPO_ROOT}"
    docker compose \
      --env-file "${COMPOSE_ENV_FILE}" \
      -f "${COMPOSE_FILE}" \
      "$@"
  )
}

usage() {
  cat <<'EOF'
Usage: deploy/deploy.sh <command>

Commands:
  up       Build and start the stack, then run database migrations.
  migrate  Run database migrations against the backend service.
  bootstrap-admin  Create or refresh the initial admin account using BOOTSTRAP_ADMIN_* env vars.
  seed     Run the backend seed script.
  logs     Tail logs from all services.
  pull-up  Pull latest images in the compose stack, then start and migrate.
EOF
}

command="${1:-up}"

case "${command}" in
  up)
    compose up -d --build
    compose --profile ops run --rm backend-ops bun run --cwd apps/backend db:migrate
    ;;
  migrate)
    compose --profile ops run --rm backend-ops bun run --cwd apps/backend db:migrate
    ;;
  bootstrap-admin)
    : "${BOOTSTRAP_ADMIN_NAME:?BOOTSTRAP_ADMIN_NAME must be set}"
    : "${BOOTSTRAP_ADMIN_PHONE:?BOOTSTRAP_ADMIN_PHONE must be set}"
    : "${BOOTSTRAP_ADMIN_PASSWORD:?BOOTSTRAP_ADMIN_PASSWORD must be set}"
    compose --profile ops run --rm \
      -e BOOTSTRAP_ADMIN_NAME \
      -e BOOTSTRAP_ADMIN_PHONE \
      -e BOOTSTRAP_ADMIN_PASSWORD \
      backend-ops bun run --cwd apps/backend db:bootstrap-admin
    ;;
  seed)
    compose --profile ops run --rm backend-ops bun run --cwd apps/backend db:seed
    ;;
  logs)
    compose logs -f
    ;;
  pull-up)
    compose pull
    compose up -d
    compose --profile ops run --rm backend-ops bun run --cwd apps/backend db:migrate
    ;;
  *)
    usage
    exit 1
    ;;
esac
