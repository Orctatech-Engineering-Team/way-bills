import { Hono } from 'hono'
import { and, asc, count, desc, eq, gte, isNull, lte } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/client'
import {
  clients,
  invoiceItems,
  invoices,
  users,
  waybills,
  type InvoiceStatus,
} from '../db/schema'
import { requireAuth, requireRole, type AppVariables } from '../lib/auth'
import {
  calculateDeliveryCharges,
  endOfBillingWeek,
  startOfBillingWeek,
} from '../lib/billing'
import { AppError, assert } from '../lib/errors'
import { parseJson } from '../lib/http'
import { buildInvoicePdf } from '../lib/pdf'
import type { InvoicePdfDetail } from '../lib/pdf.types'

const createInvoiceSchema = z.object({
  clientId: z.string().min(1),
  start: z.iso.date(),
  end: z.iso.date(),
  dueDate: z.iso.date().optional(),
  notes: z.string().nullable().optional(),
})

const updateInvoiceStatusSchema = z.object({
  status: z.enum(['paid', 'void']),
})

function createInvoiceNumber(date: Date, sequence: number) {
  const stamp = date.toISOString().slice(0, 10).replaceAll('-', '')
  return `INV-${stamp}-${String(sequence).padStart(3, '0')}`
}

function serializeInvoiceDetail(detail: Awaited<ReturnType<typeof getInvoiceDetail>>) {
  return {
    ...detail,
    periodStart: detail.periodStart.toISOString(),
    periodEnd: detail.periodEnd.toISOString(),
    issuedAt: detail.issuedAt.toISOString(),
    dueAt: detail.dueAt.toISOString(),
    paidAt: detail.paidAt?.toISOString() ?? null,
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

async function getInvoiceDetail(id: string) {
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

function toInvoicePdfDetail(detail: Awaited<ReturnType<typeof getInvoiceDetail>>): InvoicePdfDetail {
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

export const invoiceRoutes = new Hono<{ Variables: AppVariables }>()
invoiceRoutes.use('*', requireAuth, requireRole(['admin', 'ops']))

invoiceRoutes.get('/', async (c) => {
  const clientId = c.req.query('client_id')
  const status = c.req.query('status')
  const conditions = []

  if (clientId) {
    conditions.push(eq(invoices.clientId, clientId))
  }

  if (status) {
    conditions.push(eq(invoices.status, status as InvoiceStatus))
  }

  const items = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      clientId: invoices.clientId,
      clientName: clients.name,
      currency: invoices.currency,
      subtotalCents: invoices.subtotalCents,
      status: invoices.status,
      periodStart: invoices.periodStart,
      periodEnd: invoices.periodEnd,
      issuedAt: invoices.issuedAt,
      dueAt: invoices.dueAt,
      paidAt: invoices.paidAt,
      createdAt: invoices.createdAt,
    })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(invoices.createdAt))

  return c.json({ items, total: items.length })
})

invoiceRoutes.get('/:id', async (c) => {
  const detail = await getInvoiceDetail(c.req.param('id'))
  return c.json({ invoice: serializeInvoiceDetail(detail) })
})

invoiceRoutes.post('/', async (c) => {
  const currentUser = c.get('user')
  const input = await parseJson(c, createInvoiceSchema.parse)
  const client = await db.query.clients.findFirst({
    where: eq(clients.id, input.clientId),
  })

  assert(client, new AppError(404, 'not_found', 'Client not found.'))

  const startDate = new Date(`${input.start}T00:00:00.000Z`)
  const endDate = new Date(`${input.end}T23:59:59.999Z`)

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
        gte(waybills.completionTime, startDate),
        lte(waybills.completionTime, endDate),
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
  const dueAt = input.dueDate
    ? new Date(`${input.dueDate}T23:59:59.999Z`)
    : new Date(now.getTime() + client.paymentTermsDays * 86400000)
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
      periodStart: startDate,
      periodEnd: endDate,
      subtotalCents,
      status: 'issued',
      issuedAt: now,
      dueAt,
      notes: input.notes ?? null,
      createdBy: currentUser.id,
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

  const detail = await getInvoiceDetail(invoiceId)
  return c.json({ invoice: serializeInvoiceDetail(detail) }, 201)
})

invoiceRoutes.patch('/:id/status', async (c) => {
  const input = await parseJson(c, updateInvoiceStatusSchema.parse)
  const invoiceId = c.req.param('id')
  const existing = await db.query.invoices.findFirst({
    where: eq(invoices.id, invoiceId),
  })

  assert(existing, new AppError(404, 'not_found', 'Invoice not found.'))

  await db
    .update(invoices)
    .set({
      status: input.status,
      paidAt: input.status === 'paid' ? new Date() : null,
    })
    .where(eq(invoices.id, invoiceId))

  const detail = await getInvoiceDetail(invoiceId)
  return c.json({ invoice: serializeInvoiceDetail(detail) })
})

invoiceRoutes.get('/:id/pdf', async (c) => {
  const detail = await getInvoiceDetail(c.req.param('id'))
  const bytes = await buildInvoicePdf(toInvoicePdfDetail(detail))

  return new Response(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${detail.invoiceNumber}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
})
