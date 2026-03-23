import { and, asc, eq, gte, isNotNull, isNull, lt } from 'drizzle-orm'
import { config } from '../config'
import { db } from '../db/client'
import { invoiceItems, users, waybills } from '../db/schema'
import { endOfBillingWeek, startOfBillingWeek } from './billing'
import { AppError, assert } from './errors'
import { createInvoiceForWindow } from './invoices'
import { createRoleNotifications } from './notifications'

type PendingDeliveryRecord = {
  clientId: string | null
  completionTime: Date | null
}

export type PendingInvoiceWindow = {
  clientId: string
  periodStart: Date
  periodEnd: Date
  deliveredCount: number
}

export function buildPendingInvoiceWindows(
  deliveries: PendingDeliveryRecord[],
  options: {
    now?: Date
    lookbackWeeks?: number
  } = {},
) {
  const now = options.now ?? new Date()
  const lookbackWeeks = Math.max(1, options.lookbackWeeks ?? 8)
  const currentWeekStart = startOfBillingWeek(now)
  const lookbackStart = new Date(currentWeekStart)
  lookbackStart.setUTCDate(lookbackStart.getUTCDate() - lookbackWeeks * 7)

  const windows = new Map<string, PendingInvoiceWindow>()

  for (const delivery of deliveries) {
    if (!delivery.clientId || !delivery.completionTime) {
      continue
    }

    if (delivery.completionTime >= currentWeekStart || delivery.completionTime < lookbackStart) {
      continue
    }

    const periodStart = startOfBillingWeek(delivery.completionTime)
    const key = `${delivery.clientId}:${periodStart.toISOString()}`
    const existing = windows.get(key)

    if (existing) {
      existing.deliveredCount += 1
      continue
    }

    windows.set(key, {
      clientId: delivery.clientId,
      periodStart,
      periodEnd: endOfBillingWeek(periodStart),
      deliveredCount: 1,
    })
  }

  return [...windows.values()].sort((left, right) => {
    const byStart = left.periodStart.getTime() - right.periodStart.getTime()
    if (byStart !== 0) {
      return byStart
    }

    return left.clientId.localeCompare(right.clientId)
  })
}

async function resolveAutomationActor() {
  const configuredPhone = config.automationActorPhone.trim()

  if (configuredPhone) {
    const actor = await db.query.users.findFirst({
      where: eq(users.phone, configuredPhone),
    })

    assert(
      actor && actor.active && (actor.role === 'admin' || actor.role === 'ops'),
      new AppError(
        500,
        'automation_actor_invalid',
        'AUTOMATION_ACTOR_PHONE must match an active admin or ops account.',
      ),
    )

    return actor
  }

  const actor = await db.query.users.findFirst({
    where: eq(users.active, true),
    orderBy: asc(users.createdAt),
  })

  assert(
    actor && (actor.role === 'admin' || actor.role === 'ops'),
    new AppError(
      500,
      'automation_actor_missing',
      'Create an admin or ops account, or set AUTOMATION_ACTOR_PHONE before enabling invoice automation.',
    ),
  )

  return actor
}

export async function runInvoiceAutomationSweep(options: {
  now?: Date
  lookbackWeeks?: number
} = {}) {
  const actor = await resolveAutomationActor()
  const now = options.now ?? new Date()
  const lookbackWeeks = Math.max(
    1,
    options.lookbackWeeks ?? config.invoiceAutomationLookbackWeeks,
  )
  const currentWeekStart = startOfBillingWeek(now)
  const lookbackStart = new Date(currentWeekStart)
  lookbackStart.setUTCDate(lookbackStart.getUTCDate() - lookbackWeeks * 7)

  const deliveries = await db
    .select({
      clientId: waybills.clientId,
      completionTime: waybills.completionTime,
    })
    .from(waybills)
    .leftJoin(invoiceItems, eq(invoiceItems.waybillId, waybills.id))
    .where(
      and(
        eq(waybills.status, 'delivered'),
        isNotNull(waybills.clientId),
        isNotNull(waybills.completionTime),
        isNull(invoiceItems.id),
        gte(waybills.completionTime, lookbackStart),
        lt(waybills.completionTime, currentWeekStart),
      ),
    )

  const windows = buildPendingInvoiceWindows(deliveries, {
    now,
    lookbackWeeks,
  })

  let createdCount = 0
  let reusedCount = 0

  for (const window of windows) {
    const result = await createInvoiceForWindow({
      clientId: window.clientId,
      periodStart: window.periodStart,
      periodEnd: window.periodEnd,
      createdBy: actor.id,
      source: 'automatic',
      onExisting: 'reuse',
    })

    if (result.created) {
      createdCount += 1
      await createRoleNotifications(['admin', 'ops'], {
        type: 'invoice_ready',
        title: 'Weekly invoice generated',
        message: `${result.invoice.invoiceNumber} was created automatically for ${result.invoice.client.name}.`,
        linkPath: '/ops/invoices',
        eventKey: `invoice_ready:${result.invoice.id}`,
      })
    } else {
      reusedCount += 1
    }
  }

  return {
    actorId: actor.id,
    scannedWindows: windows.length,
    createdCount,
    reusedCount,
    lookbackWeeks,
  }
}
