#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/backend.env"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}. Copy deploy/backend.env.example first." >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump is required. Install the PostgreSQL client tools on the host first." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

: "${DATABASE_URL:?DATABASE_URL must be set in deploy/backend.env}"

BACKUP_DIR="${BACKUP_DIR:-/srv/backups/way-bills/postgres}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILENAME="waybills_${TIMESTAMP}.dump"
DESTINATION="${BACKUP_DIR}/${FILENAME}"

mkdir -p "${BACKUP_DIR}"

pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file "${DESTINATION}" \
  "${DATABASE_URL}"

sha256sum "${DESTINATION}" > "${DESTINATION}.sha256"

echo "Created ${DESTINATION}"
echo "Checksum ${DESTINATION}.sha256"
