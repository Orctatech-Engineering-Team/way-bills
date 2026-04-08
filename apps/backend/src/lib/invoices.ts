import { and, asc, count, eq, gte, isNull, lte } from 'drizzle-orm'
import { db } from '../db/client'
import {
  clients,
  invoiceItems,
  invoices,
  waybills,
  type InvoiceSource,
} from '../db/schema'
import {
  calculateDeliveryCharges,
  endOfBillingWeek,
  startOfBillingWeek,
} from './billing'
import { AppError, assert } from './errors'
import type { InvoicePdfDetail } from './pdf.types'

export type CreateInvoiceInput = {
  clientId: string
  periodStart: Date
  periodEnd: Date
  dueAt?: Date | null
  notes?: string | null
  createdBy: string
  source?: InvoiceSource
  onExisting?: 'error' | 'reuse'
}

export function createInvoiceNumber(date: Date, sequence: number) {
  const stamp = date.toISOString().slice(0, 10).replaceAll('-', '')
  return `INV-${stamp}-${String(sequence).padStart(3, '0')}`
}

function assertValidBillingWindow(start: Date, end: Date) {
  assert(
    start.getTime() <= end.getTime(),
    new AppError(400, 'invalid_billing_window', 'Invoice start date cannot be after the end date.'),
  )
}

function dateOnly(isoDate: string) {
  return new Date(`${isoDate}T00:00:00.000Z`)
}

function endOfDay(isoDate: string) {
  return new Date(`${isoDate}T23:59:59.999Z`)
}

export function invoiceWindowFromDateRange(start: string, end: string) {
  const periodStart = dateOnly(start)
  const periodEnd = endOfDay(end)
  assertValidBillingWindow(periodStart, periodEnd)
  return { periodStart, periodEnd }
}

async function findInvoiceByWindow(clientId: string, periodStart: Date, periodEnd: Date) {
  return db.query.invoices.findFirst({
    where: and(
      eq(invoices.clientId, clientId),
      eq(invoices.periodStart, periodStart),
      eq(invoices.periodEnd, periodEnd),
    ),
  })
}

export async function getInvoiceDetail(id: string) {
  const invoice = await db.query.invoices.findFirst({
    where: eq(invoices.id, id),
  })

  assert(invoice, new AppError(404, 'not_found', 'Invoice not found.'))

  const client = await db.query.clients.findFirst({
    where: eq(clients.id, invoice.clientId),
  })
  assert(client, new AppError(404, 'not_found', 'Client not found.'))

  const items = await db
    .select({
      id: invoiceItems.id,
      invoiceId: invoiceItems.invoiceId,
      waybillId: invoiceItems.waybillId,
      entryMode: waybills.entryMode,
      amountCents: invoiceItems.amountCents,
      pricingTier: invoiceItems.pricingTier,
      createdAt: invoiceItems.createdAt,
      waybillNumber: waybills.waybillNumber,
      orderReference: waybills.orderReference,
      customerName: waybills.customerName,
      completionTime: waybills.completionTime,
    })
    .from(invoiceItems)
    .innerJoin(waybills, eq(waybills.id, invoiceItems.waybillId))
    .where(eq(invoiceItems.invoiceId, id))
    .orderBy(asc(waybills.completionTime))

  return {
    ...invoice,
    client,
    items,
  }
}

export function serializeInvoiceDetail(detail: Awaited<ReturnType<typeof getInvoiceDetail>>) {
  return {
    ...detail,
    periodStart: detail.periodStart.toISOString(),
    periodEnd: detail.periodEnd.toISOString(),
    issuedAt: detail.issuedAt.toISOString(),
    dueAt: detail.dueAt.toISOString(),
    paidAt: detail.paidAt?.toISOString() ?? null,
    emailSentAt: detail.emailSentAt?.toISOString() ?? null,
    createdAt: detail.createdAt.toISOString(),
    client: {
      ...detail.client,
      createdAt: detail.client.createdAt.toISOString(),
    },
    items: detail.items.map((item) => ({
      ...item,
      completionTime: item.completionTime?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
    })),
  }
}

export function toInvoicePdfDetail(
  detail: Awaited<ReturnType<typeof getInvoiceDetail>>,
): InvoicePdfDetail {
  return {
    id: detail.id,
    invoiceNumber: detail.invoiceNumber,
    status: detail.status,
    currency: detail.currency,
    periodStart: detail.periodStart.toISOString().slice(0, 10),
    periodEnd: detail.periodEnd.toISOString().slice(0, 10),
    subtotalCents: detail.subtotalCents,
    issuedAt: detail.issuedAt.toISOString(),
    dueAt: detail.dueAt.toISOString(),
    paidAt: detail.paidAt?.toISOString() ?? null,
    notes: detail.notes,
    client: {
      ...detail.client,
      createdAt: detail.client.createdAt.toISOString(),
    },
    items: detail.items.map((item) => ({
      id: item.id,
      waybillId: item.waybillId,
      waybillNumber: item.waybillNumber,
      orderReference: item.orderReference,
      entryMode: item.entryMode as 'live' | 'historical',
      customerName: item.customerName ?? 'Unnamed recipient',
      completionTime: item.completionTime?.toISOString() ?? null,
      amountCents: item.amountCents,
      pricingTier: item.pricingTier as 'standard' | 'overflow',
    })),
  }
}

export async function createInvoiceForWindow(input: CreateInvoiceInput) {
  assertValidBillingWindow(input.periodStart, input.periodEnd)

  const existing = await findInvoiceByWindow(input.clientId, input.periodStart, input.periodEnd)
  if (existing) {
    if (input.onExisting === 'reuse') {
      return {
        created: false as const,
        invoice: await getInvoiceDetail(existing.id),
      }
    }

    throw new AppError(
      409,
      'invoice_exists',
      'An invoice already exists for that client and billing period.',
    )
  }

  const client = await db.query.clients.findFirst({
    where: eq(clients.id, input.clientId),
  })

  assert(client, new AppError(404, 'not_found', 'Client not found.'))

  const eligibleWaybills = await db
    .select({
      id: waybills.id,
      waybillNumber: waybills.waybillNumber,
      orderReference: waybills.orderReference,
      customerName: waybills.customerName,
      completionTime: waybills.completionTime,
    })
    .from(waybills)
    .leftJoin(invoiceItems, eq(invoiceItems.waybillId, waybills.id))
    .where(
      and(
        eq(waybills.clientId, input.clientId),
        eq(waybills.status, 'delivered'),
        gte(waybills.completionTime, input.periodStart),
        lte(waybills.completionTime, input.periodEnd),
        isNull(invoiceItems.id),
      ),
    )
    .orderBy(asc(waybills.completionTime))

  assert(
    eligibleWaybills.length > 0,
    new AppError(
      400,
      'no_waybills',
      'There are no delivered uninvoiced waybills for that client and period.',
    ),
  )

  const weekStarts = eligibleWaybills
    .map((item) => item.completionTime)
    .filter((value): value is Date => Boolean(value))
    .map((value) => startOfBillingWeek(value))
  const billingWindowStart = weekStarts.reduce((earliest, current) =>
    current < earliest ? current : earliest)
  const billingWindowEnd = weekStarts
    .map((value) => endOfBillingWeek(value))
    .reduce((latest, current) => (current > latest ? current : latest))

  const deliveredInCoveredWeeks = await db
    .select({
      id: waybills.id,
      clientId: waybills.clientId,
      completionTime: waybills.completionTime,
    })
    .from(waybills)
    .where(
      and(
        eq(waybills.clientId, input.clientId),
        eq(waybills.status, 'delivered'),
        gte(waybills.completionTime, billingWindowStart),
        lte(waybills.completionTime, billingWindowEnd),
      ),
    )

  const chargeMap = calculateDeliveryCharges(
    deliveredInCoveredWeeks,
    new Map([
      [
        client.id,
        {
          clientId: client.id,
          standardDeliveryRateCents: client.standardDeliveryRateCents,
          weeklyBandLimit: client.weeklyBandLimit,
          overflowDeliveryRateCents: client.overflowDeliveryRateCents,
        },
      ],
    ]),
  )

  const pricedWaybills = eligibleWaybills.map((item) => {
    const charge = chargeMap.get(item.id)

    return {
      ...item,
      amountCents: charge?.deliveryChargeCents ?? client.standardDeliveryRateCents,
      pricingTier: charge?.pricingTier ?? 'standard',
    }
  })

  const [summary] = await db.select({ count: count() }).from(invoices)
  const now = new Date()
  const dueAt =
    input.dueAt ?? new Date(now.getTime() + client.paymentTermsDays * 86400000)
  const subtotalCents = pricedWaybills.reduce(
    (total, item) => total + item.amountCents,
    0,
  )

  const invoiceId = crypto.randomUUID()
  const invoiceNumber = createInvoiceNumber(now, Number(summary?.count ?? 0) + 1)

  await db.transaction(async (tx) => {
    await tx.insert(invoices).values({
      id: invoiceId,
      invoiceNumber,
      clientId: input.clientId,
      currency: client.currency,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      subtotalCents,
      status: 'issued',
      source: input.source ?? 'manual',
      emailStatus: 'not_sent',
      emailSentAt: null,
      emailDeliveryAttempts: 0,
      lastEmailError: null,
      issuedAt: now,
      dueAt,
      notes: input.notes ?? null,
      createdBy: input.createdBy,
      createdAt: now,
    })

    await tx.insert(invoiceItems).values(
      pricedWaybills.map((item) => ({
        id: crypto.randomUUID(),
        invoiceId,
        waybillId: item.id,
        amountCents: item.amountCents,
        pricingTier: item.pricingTier,
        createdAt: now,
      })),
    )
  })

  return {
    created: true as const,
    invoice: await getInvoiceDetail(invoiceId),
  }
}
