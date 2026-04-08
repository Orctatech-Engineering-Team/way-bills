# API Reference

This document describes the backend HTTP API exposed by the Waybill System.

Base URL in production:

```text
https://api.waybills.orctatech.com
```

Local default:

```text
http://localhost:3001
```

## Authentication Model

The API uses a signed session cookie.

- login sets the `wb_session` cookie
- authenticated requests must include cookies
- frontend requests use `credentials: include`

Session behavior:

- cookie: `wb_session`
- httpOnly
- `SameSite=Lax`
- secure in production
- 12 hour expiry

## Roles

Roles:

- `admin`
- `ops`
- `rider`

Role usage:

- `admin`: full system access
- `ops`: operational management, billing, riders, reports
- `rider`: rider workflow only

## Response Style

Successful responses return JSON unless the route explicitly returns a PDF.

Typical list response:

```json
{
  "items": [],
  "total": 0
}
```

Typical detail response:

```json
{
  "waybill": {}
}
```

## Error Shape

Errors are normalized as:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Customer phone is required.",
    "details": [
      {
        "path": "customerPhone",
        "message": "Customer phone is required."
      }
    ]
  }
}
```

Common status codes:

- `400` invalid query/input
- `401` unauthenticated
- `403` forbidden
- `404` not found
- `409` workflow/state conflict
- `422` validation error
- `500` internal/server/schema issues

## Health

### `GET /health`

Purpose:

- simple API liveness check

Response:

```json
{ "ok": true }
```

## Auth

### `POST /auth/login`

Purpose:

- authenticate and create a session cookie

Body:

```json
{
  "phone": "+233241234567",
  "password": "secret123"
}
```

Notes:

- phone is normalized to Ghana `+233` format

Response:

```json
{
  "user": {
    "id": "user-id",
    "name": "Admin User",
    "phone": "+233241234567",
    "role": "admin"
  }
}
```

### `POST /auth/logout`

Purpose:

- clear the session cookie

Response:

```json
{ "success": true }
```

### `GET /auth/me`

Purpose:

- fetch the current signed-in user

Responses:

- `200` with `{ user: {...} }`
- `401` with `{ user: null }` when no session exists

## Users

Base:

```text
/users
```

Requires authentication for all endpoints.

### `GET /users`

Purpose:

- list users

Query params:

- `role`
- `active=true|false`

Role notes:

- riders can only view rider accounts

### `POST /users`

Purpose:

- create a user

Roles:

- `admin`
- `ops`

Restriction:

- `ops` can only create rider accounts

Body fields:

- `name`
- `phone`
- `role`
- `password`
- `active`
- `profileImageDataUrl`
- `defaultClientId`
- `vehicleType`
- `vehiclePlateNumber`
- `licenseNumber`
- `address`
- `notes`

### `PATCH /users/:id`

Purpose:

- update a user

Roles:

- `admin`
- `ops`

Restriction:

- `ops` can only update rider accounts and keep them in the rider role

## Clients

Base:

```text
/clients
```

### `GET /clients`

Purpose:

- list clients

Query params:

- `active=true|false`

### `POST /clients`

Purpose:

- create a client

Roles:

- `admin`
- `ops`

Body fields:

- `name`
- `contactName`
- `contactPhone`
- `contactEmail`
- `billingAddress`
- `currency`
- `paymentTermsDays`
- `standardDeliveryRateCents`
- `weeklyBandLimit`
- `overflowDeliveryRateCents`
- `active`

### `PATCH /clients/:id`

Purpose:

- update a client

Roles:

- `admin`
- `ops`

## Waybills

Base:

```text
/waybills
```

All routes require authentication.

Important workflow states:

- `created`
- `assigned`
- `dispatched`
- `delivered`
- `failed`
- `cancelled`

Important record modes:

- `live`
- `historical`

### `POST /waybills`

Purpose:

- create a new waybill

Used for:

- live rider deliveries
- historical/manual backfill

Key body fields:

- `orderReference`
- `clientId`
- `entryMode`
- `customerName`
- `customerPhone`
- `deliveryAddress`
- `deliveryMethod`
- `itemValueCents`
- `receiptImageDataUrl`
- `dispatchTime`
- `completionTime`
- `notes`

Notes:

- rider-controlled creation requires an active shift
- historical/manual records use receipt-photo evidence instead of signature

### `PATCH /waybills/batch-dispatch`

Purpose:

- dispatch multiple queued waybills together

Body:

```json
{
  "ids": ["waybill-1", "waybill-2"]
}
```

### `PATCH /waybills/batch-return-time`

Purpose:

- log one shared return time for multiple completed/failed jobs

Body:

```json
{
  "ids": ["waybill-1", "waybill-2"],
  "returnTime": "2026-03-22T18:15:00.000Z"
}
```

### `GET /waybills`

Purpose:

- list waybills

Query params:

- `status`
- `search`
- `rider_id`
- `entry_mode=live|historical`

Role notes:

- riders only see their own assigned jobs

### `GET /waybills/:id`

Purpose:

- fetch waybill detail, POD, handovers, and status history

### `PATCH /waybills/:id/receipt`

Purpose:

- replace or remove the receipt image

Body:

```json
{
  "receiptImageDataUrl": "data:image/jpeg;base64,..."
}
```

### `PATCH /waybills/:id/handover`

Purpose:

- hand over a waybill to another rider

Body:

- `riderId`
- `note`

### `PATCH /waybills/:id/assign`

Purpose:

- compatibility path for assigning older waybills

Body:

- `riderId`
- `note`

### `PATCH /waybills/:id/status`

Purpose:

- change waybill status

Body:

- `status`
- `note`

Important:

- invalid transitions are rejected
- completed/closed waybills are locked
- riders need an active shift
- failed deliveries generate admin/ops notifications

### `POST /waybills/:id/pod`

Purpose:

- create proof of delivery with recipient signature

Body:

- `recipientName`
- `signatureDataUrl`
- `note`

### `GET /waybills/:id/pod`

Purpose:

- fetch the POD record for a waybill

### `GET /waybills/:id/pdf`

Purpose:

- render the waybill PDF

Response:

- `application/pdf`

### `GET /waybills/:id/pod/pdf`

Purpose:

- render the POD PDF

Response:

- `application/pdf`

## Shifts

Base:

```text
/shifts
```

### `GET /shifts/me`

Purpose:

- fetch live rider shift dashboard

Role:

- `rider` only

Returns:

- active shift
- pending incoming handovers
- pending outgoing handovers
- shift timeline

### `GET /shifts/report`

Purpose:

- fetch shift report and timeline

Roles:

- `admin`
- `ops`

Query params:

- `start=YYYY-MM-DD`
- `end=YYYY-MM-DD`
- `rider_id` optional

### `POST /shifts/check-in`

Purpose:

- start a rider shift

Body:

- `note`

### `POST /shifts/check-out`

Purpose:

- end a rider shift

### `POST /shifts/handover`

Purpose:

- initiate a handover from the outgoing rider to the incoming rider

Body:

- `incomingRiderId`
- `note`

Effect:

- creates a pending handover
- creates a notification for the incoming rider

### `POST /shifts/handover/:id/accept`

Purpose:

- accept and complete an incoming handover

Body:

- `note`

## Invoices

Base:

```text
/invoices
```

Role:

- `admin`
- `ops`

### `GET /invoices`

Purpose:

- list invoices

Query params:

- `client_id`
- `status`

### `GET /invoices/automation-status`

Purpose:

- fetch the latest worker automation monitor status

Returns:

- enabled/running state
- interval/lookback
- last start
- last success
- last failure
- last worker error
- invoice/email sweep summaries

### `GET /invoices/:id`

Purpose:

- fetch invoice detail and line items

### `POST /invoices`

Purpose:

- manually create an invoice for a billing window

Body:

- `clientId`
- `start`
- `end`
- `dueDate`
- `notes`

### `PATCH /invoices/:id/status`

Purpose:

- mark invoice as paid or void

Body:

```json
{
  "status": "paid"
}
```

### `POST /invoices/:id/send-email`

Purpose:

- send or retry invoice email delivery

Notes:

- requires a client billing email
- void invoices cannot be emailed

### `GET /invoices/:id/pdf`

Purpose:

- render invoice PDF

Response:

- `application/pdf`

## Reports

Base:

```text
/reports
```

Role:

- `admin`
- `ops`

### `GET /reports/weekly`

Purpose:

- fetch completed delivery report for a date range

Query params:

- `start=YYYY-MM-DD`
- `end=YYYY-MM-DD`
- `rider_id` optional
- `entry_mode=live|historical` optional

Returns:

- delivery items
- grouped totals
- summary totals

### `GET /reports/billing-summary`

Purpose:

- fetch billing-oriented delivery summary

Query params:

- `start=YYYY-MM-DD`
- `end=YYYY-MM-DD`
- `client_id` optional
- `invoice_status=uninvoiced` optional
- `entry_mode=live|historical` optional

Returns:

- waybill billing items
- grouped client totals
- overall billing totals

## Notifications

Base:

```text
/notifications
```

Requires authentication.

### `GET /notifications`

Purpose:

- list notifications for the current user

Query params:

- `unread_only=true`
- `limit`

Returns:

- `items`
- `unreadCount`

### `POST /notifications/:id/read`

Purpose:

- mark one notification read

Returns:

- refreshed notification list
- unread count

### `POST /notifications/read-all`

Purpose:

- mark all notifications read for the current user

Returns:

- refreshed notification list
- unread count

## Files And Evidence

The API interacts with Cloudflare R2 for:

- profile images
- receipt photos
- recipient signatures
- generated waybill/POD/invoice PDFs

Public file URLs are stored after upload and returned through JSON resources.

## Notes For Integrators

- this API is designed for the first-party frontend, not public third-party API consumers
- authentication is cookie-based rather than token-in-header
- PDF endpoints return binary responses
- several workflows are role-sensitive and state-sensitive
- invoice automation itself is run by the worker, not by public HTTP endpoints

## Related Docs

- [Root README](/home/bernard/Work/way-bills/README.md)
- [Architecture Overview](/home/bernard/Work/way-bills/docs/architecture.md)
- [Role Guide](/home/bernard/Work/way-bills/docs/role-guide.md)
- [Operations Runbook](/home/bernard/Work/way-bills/docs/ops-runbook.md)
