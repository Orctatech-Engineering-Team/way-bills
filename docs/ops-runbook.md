# Operations Runbook

This is the practical production checklist for the Waybill system on your VPS.

## What Must Be Protected

- PostgreSQL: all operational state lives here
- Cloudflare R2 buckets:
  - uploads bucket: profile images, receipt photos, signatures
  - documents bucket: PDFs
- `deploy/backend.env` and `deploy/compose.env`

If you lose Postgres, the app loses users, clients, waybills, shifts, invoices, and notifications.
If you lose R2, the app loses proof files and generated documents.

## Backup Routine

### PostgreSQL

Take a daily dump and keep multiple restore points.

Recommended minimum:

- daily backup
- keep 7 daily copies
- keep 4 weekly copies
- keep 3 monthly copies

Use the helper script from the repo root:

```bash
bash deploy/backup-postgres.sh
```

Requirements:

- `deploy/backend.env` must exist
- `DATABASE_URL` must be valid
- `pg_dump` must be installed on the VPS

Default output location:

```text
/srv/backups/way-bills/postgres
```

You can override that per host:

```bash
BACKUP_DIR=/srv/backups/way-bills/postgres bash deploy/backup-postgres.sh
```

Each backup writes:

- a custom-format Postgres dump
- a `sha256` checksum file next to it

### Cloudflare R2

R2 is not automatically protected by your Postgres dumps.

Recommended:

- enable bucket versioning if available for your plan/workflow
- set lifecycle/retention rules appropriate to your evidence requirements
- restrict delete access tightly
- do periodic object inventory review

At minimum, document:

- bucket names
- public URLs
- access key location
- who can rotate credentials

For this app, you should treat these as business records:

- receipt photos
- delivery signatures
- generated invoices/PODs/waybills if clients depend on them later

## Restore Routine

### PostgreSQL Restore

Only do a full restore into a target database you intend to overwrite.

Use the helper script:

```bash
bash deploy/restore-postgres.sh /srv/backups/way-bills/postgres/waybills_20260322T120000Z.dump --yes-i-understand
```

Requirements:

- `deploy/backend.env` must exist
- `DATABASE_URL` must point at the restore target
- `pg_restore` must be installed

The script restores with:

- `--clean`
- `--if-exists`
- `--no-owner`
- `--no-privileges`

That means existing objects in the target DB are dropped/recreated.

### Recommended Safe Restore Flow

1. Stop the app stack.
2. Restore into a separate database first if possible.
3. Validate:
   - users can log in
   - waybills load
   - invoices load
   - worker automation status reads
4. Point production back only after validation.

## Operational Checks

### App Health

Check containers:

```bash
docker compose --env-file deploy/compose.env -f deploy/docker-compose.yml ps
```

Check logs:

```bash
docker compose --env-file deploy/compose.env -f deploy/docker-compose.yml logs -f backend
docker compose --env-file deploy/compose.env -f deploy/docker-compose.yml logs -f backend-worker
```

HTTP checks:

```bash
curl -fsS https://api.waybills.orctatech.com/health
curl -fsS https://waybills.orctatech.com
```

### Worker Health

The worker now has a Docker healthcheck.

Healthy means one of:

- automation is disabled
- a sweep is actively running
- a recent run is still fresh and the latest completed run did not fail

Unhealthy means one of:

- the worker has gone stale
- the latest completed sweep failed and has not recovered

You can also inspect the invoices page automation monitor for:

- last run started
- last success
- last failure
- last invoice sweep summary
- last email delivery summary
- last email error

## Failure Recovery

### Invoice Automation Not Running

Symptoms:

- `backend-worker` unhealthy
- automation monitor shows old timestamps
- new weekly invoices stop appearing

Checklist:

1. Check `backend-worker` logs.
2. Confirm `INVOICE_AUTOMATION_ENABLED=true`.
3. Confirm `AUTOMATION_ACTOR_PHONE` is set to an active `admin` or `ops` user, or that at least one active `admin/ops` user exists.
4. Restart the worker:

```bash
docker compose --env-file deploy/compose.env -f deploy/docker-compose.yml restart backend-worker
```

1. Recheck the automation monitor.

### Invoice Email Failures

Symptoms:

- invoice `emailStatus` becomes `failed`
- admin/ops notifications appear for invoice email failure
- automation monitor shows email failure

Checklist:

1. Check SMTP envs:
   - `MAIL_ENABLED`
   - `SMTP_HOST`
   - `SMTP_PORT`
   - `SMTP_SECURE`
   - `SMTP_USER`
   - `SMTP_PASSWORD`
   - `MAIL_FROM`
2. Check `backend-worker` logs for SMTP/auth errors.
3. Confirm the client has a valid `contactEmail`.
4. Retry from the invoice UI.

### Notifications Missing

Symptoms:

- expected handover/failed-delivery/invoice notifications do not appear

Checklist:

1. Confirm the latest DB migrations are applied.
2. Confirm the user is still active.
3. Check backend logs for route or worker errors.
4. Reload the app and inspect `/notifications` traffic if needed.

### R2 Upload or File Access Failures

Symptoms:

- images do not open
- PDF/document links break

Checklist:

1. Verify:
   - `R2_ENDPOINT`
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_STORAGE_BUCKET`
   - `R2_STORAGE_PUBLIC_BASE_URL`
   - `R2_DOCUMENT_BUCKET`
   - `R2_DOCUMENT_PUBLIC_BASE_URL`
2. Confirm the bucket public URLs are the correct `r2.dev` or custom bucket base URLs.
3. Confirm bucket/object permissions have not changed.

## Change Window Checklist

Before deploying:

- backup Postgres
- confirm current worker health
- confirm current invoice/email backlog state

After deploying:

- run migrations
- verify API health
- verify frontend loads
- verify worker container becomes healthy
- open the invoices page automation monitor

## Recommended Cron

Example nightly Postgres backup:

```cron
15 2 * * * cd /srv/apps/way-bills && /usr/bin/bash deploy/backup-postgres.sh >> /var/log/waybills-backup.log 2>&1
```

You can handle retention with a separate housekeeping job or your backup target policy.
