# WAYBILL SYSTEM — MVP SPEC (v1)

## 0. Objective

Build a **web-based waybill system** that:

- creates delivery records (waybills)
- assigns riders
- tracks delivery state
- captures proof of delivery (signature)
- produces a weekly completed-deliveries summary

Nothing more.

------

# 1. Non-Negotiable Constraints

These are hard rules.

## Stack

- Frontend: **React + Vite**
- Backend: **Bun + Hono + TypeScript**
- ORM: **Drizzle**
- Database: **PostgreSQL**
- Storage: **S3-compatible (Supabase first)**
- PDF: **@libpdf/core**
- Signing: **canvas-based stroke capture**

## Architecture

- single repo (monorepo optional but not required)
- single API service
- REST only
- no GraphQL
- no microservices
- no queues
- no websockets

## Product constraints

- web only (no mobile app)
- no maps
- no GPS tracking
- no notifications
- no external integrations

------

# 2. Core System Model

## Entities

### User

```ts
id: string
name: string
phone: string
role: "admin" | "ops" | "rider"
password_hash: string
active: boolean
created_at: timestamp
```

------

### Waybill

```ts
id: string
waybill_number: string

order_reference: string

customer_name: string
customer_phone: string
delivery_address: string
notes: string | null

requested_dispatch_time: timestamp | null
dispatch_time: timestamp | null
completion_time: timestamp | null

assigned_rider_id: string | null

status:
  | "created"
  | "assigned"
  | "dispatched"
  | "delivered"
  | "failed"
  | "cancelled"

created_by: string
created_at: timestamp
updated_at: timestamp
```

------

### ProofOfDelivery

```ts
id: string
waybill_id: string

recipient_name: string

signature_file_url: string
signature_mime_type: string
signature_captured_at: timestamp

completed_at: timestamp
note: string | null

created_by: string
created_at: timestamp
```

------

### StatusLog

```ts
id: string
waybill_id: string

from_status: string
to_status: string

changed_by: string
changed_at: timestamp
note: string | null
```

------

### Document (optional early)

```ts
id: string
waybill_id: string

type: "waybill_pdf" | "pod_pdf"
file_url: string

created_at: timestamp
```

------

# 3. State Machine

Strict transitions:

```txt
created → assigned
created → cancelled

assigned → dispatched
assigned → failed
assigned → cancelled

dispatched → delivered
dispatched → failed
```

## Rules

- cannot skip states
- `delivered` requires POD
- `completion_time` set only on delivery
- `dispatch_time` set only on dispatch

------

# 4. API Contract (Minimal)

## Auth

```
POST   /auth/login
POST   /auth/logout
GET    /auth/me
```

------

## Waybills

```
POST   /waybills
GET    /waybills
GET    /waybills/:id

PATCH  /waybills/:id/assign
PATCH  /waybills/:id/status
```

------

## POD

```
POST   /waybills/:id/pod
GET    /waybills/:id/pod
```

------

## Reports

```
GET    /reports/weekly
```

Query:

```
?start=YYYY-MM-DD
&end=YYYY-MM-DD
&rider_id=optional
```

------

## Users

```
GET    /users
POST   /users
PATCH  /users/:id
```

------

# 5. Core Flows

## Flow 1 — Create Waybill

1. ops fills form
2. backend:
   - generates `waybill_number`
   - inserts record
   - status = `created`

------

## Flow 2 — Assign Rider

1. ops selects rider
2. update:
   - `assigned_rider_id`
   - status = `assigned`
3. write status log

------

## Flow 3 — Dispatch

1. rider or ops clicks dispatch
2. update:
   - `dispatch_time = now`
   - status = `dispatched`

------

## Flow 4 — Delivery + POD

1. rider enters:
   - recipient name
2. signature captured via canvas
3. upload signature
4. backend:
   - insert POD
   - set `completion_time`
   - status = `delivered`

------

## Flow 5 — Weekly Report

- filter all:

  ```
  status = delivered
  AND completion_time in range
  ```

- group:

  - by rider
  - by day

- return list + totals

------

# 6. UI Specification

## Philosophy

The UI must be:

- fast
- obvious
- low cognitive load
- operational, not decorative

No “startup aesthetic noise”.

------

## Design Rules (Strict)

### 1. One screen = one job

- create waybill screen → only creation
- rider screen → only active jobs

------

### 2. No deep nesting

Max:

- 2 levels of navigation

------

### 3. No hidden state

- every action must be visible
- status must always be visible

------

### 4. Default to lists

- operations are list-driven
- not dashboard-driven

------

### 5. Forms must be fast

- tab-friendly
- minimal fields
- no unnecessary validation blocking

------

### 6. No modal-heavy UX

- prefer inline or page transitions

------

### 7. Status is primary visual signal

Use color minimally:

- created → neutral
- assigned → blue
- dispatched → orange
- delivered → green
- failed → red

------

## Layout Structure

### App Shell

```
Sidebar (fixed)
Topbar (light)
Content (scroll)
```

------

## Routes

### Ops

```
/ops/waybills
/ops/waybills/new
/ops/waybills/:id
/ops/reports
```

------

### Rider

```
/rider/jobs
/rider/jobs/:id
```

------

### Admin

```
/admin/users
/admin/riders
```

------

## Key Screens

### 1. Waybill List

- table
- search
- filter by status
- click row → detail

------

### 2. Create Waybill

- simple form
- submit → redirect to detail

------

### 3. Waybill Detail

- full info
- status
- assign rider
- update status
- POD section

------

### 4. Rider Jobs

- list of assigned jobs
- sorted by status
- quick actions:
  - dispatch
  - complete

------

### 5. POD Capture

- recipient name input
- signature canvas
- submit button

------

### 6. Weekly Report

- table of completed deliveries
- totals
- filter by date

------

# 7. Signature Capture Spec

- HTML canvas
- store as:
  - PNG or SVG
- upload immediately
- preview before submit

Do not over-engineer.

------

# 8. PDF Strategy (MVP)

Do **not** block MVP on PDFs.

Implementation:

Option A (fastest)

- HTML → print/export

Option B (after)

- generate PDF via libpdf

Rule:

> PDF is an output, not the source of truth.

------

# 9. Performance Rules

- initial load < 2s on 3G
- API response < 300ms typical
- no large bundles
- lazy load routes

------

# 10. Deployment Constraints

- single deployable backend
- static frontend build
- no CI complexity required initially

------

# 11. Security (Minimal but sane)

- password hashing (argon2 or bcrypt)
- JWT auth
- role-based route protection
- validate all inputs

------

# 12. UI/UX References (Serious, not fluff)

Study these, not Dribbble noise:

## Core references

- Refactoring UI — [https://www.refactoringui.com](https://www.refactoringui.com/)
- Nielsen Norman Group — [https://www.nngroup.com](https://www.nngroup.com/)
- Gov.uk Design System — [https://design-system.service.gov.uk](https://design-system.service.gov.uk/)
- Linear (product reference) — [https://linear.app](https://linear.app/)
- Stripe Dashboard — [https://stripe.com](https://stripe.com/)

## Design principles

- Dieter Rams — 10 principles
- “Less, but better”
- clarity > cleverness
- speed > aesthetics

## Practical systems

- [https://ui.shadcn.com](https://ui.shadcn.com/)
- [https://tailwindui.com](https://tailwindui.com/)
- [https://headlessui.com](https://headlessui.com/)

------

# 13. What NOT to do

- no animations beyond subtle transitions
- no charts in MVP
- no “dashboard overview cards”
- no real-time updates
- no over-validation
- no premature abstraction

------

# 14. Definition of Done (MVP)

System is complete when:

- ops can create waybill
- ops can assign rider
- rider can view assigned jobs
- rider can mark dispatched
- rider can complete delivery
- signature is captured and stored
- delivery is marked delivered
- weekly report shows completed deliveries

If any of these fail → MVP is not done.

------

# Final note

This spec is intentionally narrow.

If the agent tries to:

- add features
- redesign flows
- introduce complexity

…it is wrong.

Build exactly this.