# Role Guide

This guide explains what each role can do in the Waybill System and how each role should use the product day to day.

Roles:

- `admin`
- `ops`
- `rider`

## Shared Rules

These rules apply to everyone:

- phone numbers are stored in Ghana format and normalized to `+233`
- delivered records feed billing and invoicing
- historical/manual deliveries are valid billable records, but use receipt-photo evidence instead of recipient signature
- notifications surface important operational events like shift handovers, failed deliveries, and invoice issues
- completed/locked waybills cannot be freely edited afterward

## Admin

### What Admin Can Do

Admins have full operational access.

They can:

- view and manage all waybills
- create and update all users
- create and update riders
- create and update clients
- review reports
- create invoices
- change invoice status
- send invoice emails
- view automation monitor and notification events

### Admin Screens

Main screens:

- waybills
- riders
- clients
- invoices
- reports
- users

### Typical Admin Workflow

1. Create the initial users and riders.
2. Set up client billing information and pricing rules.
3. Review delivery operations and reporting.
4. Review invoice automation status and email failures.
5. Step in when there are failed deliveries, account issues, or data corrections.

### Admin Notes

- admins are the safest default owner for automation oversight
- the invoice worker can use an active `admin` account as its automation actor
- admins should be the ones to verify deploys, migrations, and billing automation health

## Ops

### What Ops Can Do

Ops is the day-to-day operations role.

Ops can:

- view and manage all waybills
- create and update rider accounts
- create and update clients
- review reports
- create invoices
- change invoice status
- send invoice emails
- review notifications and automation monitor

Ops cannot:

- create or manage non-rider user accounts
- promote users into admin

### Ops Screens

Main screens:

- waybills
- riders
- clients
- invoices
- reports

### Typical Ops Workflow

1. Review queued, dispatched, failed, and delivered waybills.
2. Track rider activity and investigate failed deliveries.
3. Review historical/manual backfilled deliveries.
4. Generate invoices if needed manually.
5. Monitor automatic invoice generation and resend failed invoice emails.
6. Review shift and handover reports.

### Ops Notes

- ops is the primary business operator for delivery flow and billing review
- ops can create rider accounts, but not admin or other ops accounts
- ops should monitor the notification center for:
  - failed deliveries
  - invoice-ready events
  - invoice email failures

## Rider

### What Rider Can Do

Riders use the system for field delivery work.

Riders can:

- check in and check out of shifts
- initiate and accept shift handovers
- create new live deliveries
- create historical/manual backfilled deliveries
- batch dispatch queued waybills
- update their delivery statuses
- capture proof of delivery
- log return time for one or more completed route jobs
- view their shift timeline and pending handovers

Riders cannot:

- access admin/ops reporting views
- manage other users broadly
- manage clients
- manage invoices

### Rider Screens

Main screens:

- `My Jobs`
- `New Delivery`

### Rider Daily Workflow

#### Live Deliveries

1. Log in.
2. Check in to start the shift.
3. Create one or more waybills.
4. Queue them.
5. Batch dispatch the selected waybills when leaving.
6. Complete deliveries with recipient signature.
7. If a delivery fails, record the failure state.
8. Log return time for completed/failed jobs when back from the route.
9. Check out or complete a handover.

#### Historical Backfill

Use this when entering old paper-era deliveries.

1. Open `New Delivery`.
2. Switch to `Historical`.
3. Enter dispatch and completion times manually.
4. Attach the receipt photo.
5. Save the record.

Important:

- historical deliveries do not need recipient signature
- they still appear in billing and invoices
- they are clearly marked as historical records

#### Shift Handover

1. Outgoing rider starts handover to the incoming rider.
2. Incoming rider logs in and accepts.
3. The system records both sides of the shift change.
4. Notifications surface pending incoming handovers.

### Rider Notes

- riders must have an active shift before performing rider-controlled delivery actions
- if the app says to check in first, the rider must start a shift before continuing
- return time should be logged after the delivery run, especially if several jobs were dispatched together

## Evidence Types

The system supports two main evidence paths.

### Live Delivery Evidence

- recipient signature
- completion timestamp
- rider trail

### Historical Delivery Evidence

- receipt photo
- manual dispatch/completion timestamps
- no recipient signature required

## Notifications By Role

### Admin and Ops

Will receive notifications for:

- failed deliveries
- automatically generated invoices
- invoice email failures

### Rider

Will receive notifications for:

- pending incoming shift handovers

## Common Situations

### A rider cannot create or update a delivery

Most likely cause:

- no active shift

Action:

- check in first, then retry

### A client invoice was generated automatically

What to do:

- open invoices
- review the invoice
- confirm client email
- send or retry email if needed

### A historical/manual delivery must appear in billing

What to check:

- it was saved as delivered/completed
- completion time is present
- receipt-photo evidence is attached

### A failed delivery needs follow-up

What to do:

- review the failed waybill in ops/admin
- check rider notes and timestamps
- reassign or resolve operationally

## Recommended Separation Of Duties

Recommended practice:

- `admin`: platform ownership, access control, system oversight
- `ops`: daily dispatch, delivery oversight, billing review, invoice follow-up
- `rider`: field execution, live delivery updates, shift workflow

This keeps the app closer to real delivery operations and reduces accidental cross-role misuse.
