#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/backend.env"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}. Copy deploy/backend.env.example first." >&2
  exit 1
fi

if ! command -v pg_restore >/dev/null 2>&1; then
  echo "pg_restore is required. Install the PostgreSQL client tools on the host first." >&2
  exit 1
fi

BACKUP_FILE="${1:-}"
CONFIRM="${2:-}"

if [[ -z "${BACKUP_FILE}" ]]; then
  echo "Usage: deploy/restore-postgres.sh <backup.dump> --yes-i-understand" >&2
  exit 1
fi

if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "Backup file not found: ${BACKUP_FILE}" >&2
  exit 1
fi

if [[ "${CONFIRM}" != "--yes-i-understand" ]]; then
  echo "Refusing to restore without --yes-i-understand." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

: "${DATABASE_URL:?DATABASE_URL must be set in deploy/backend.env}"

pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname "${DATABASE_URL}" \
  "${BACKUP_FILE}"

echo "Restore completed from ${BACKUP_FILE}"
