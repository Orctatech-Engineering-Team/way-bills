import { Hono } from 'hono'
import { and, asc, eq, gte, isNull, lte } from 'drizzle-orm'
import { db } from '../db/client'
import {
  clients,
  invoiceItems,
  invoices,
  proofOfDeliveries,
  users,
  waybills,
} from '../db/schema'
import { requireAuth, requireRole, type AppVariables } from '../lib/auth'
import {
  calculateDeliveryCharges,
  endOfBillingWeek,
  startOfBillingWeek,
} from '../lib/billing'
import { AppError } from '../lib/errors'

export const reportRoutes = new Hono<{ Variables: AppVariables }>()
reportRoutes.use('*', requireAuth, requireRole(['admin', 'ops']))

reportRoutes.get('/weekly', async (c) => {
  const start = c.req.query('start')
  const end = c.req.query('end')
  const riderId = c.req.query('rider_id')
  const entryMode = c.req.query('entry_mode')

  if (!start || !end) {
    throw new AppError(
      400,
      'invalid_query',
      'Both start and end query parameters are required.',
    )
  }

  const startDate = new Date(`${start}T00:00:00.000Z`)
  const endDate = new Date(`${end}T23:59:59.999Z`)

  if (Number.isNaN(startDate.valueOf()) || Number.isNaN(endDate.valueOf())) {
    throw new AppError(
      400,
      'invalid_query',
      'start and end must be valid YYYY-MM-DD values.',
    )
  }

  const conditions = [
    eq(waybills.status, 'delivered'),
    gte(waybills.completionTime, startDate),
    lte(waybills.completionTime, endDate),
  ]

  if (riderId) {
    conditions.push(eq(waybills.assignedRiderId, riderId))
  }

  if (entryMode === 'live' || entryMode === 'historical') {
    conditions.push(eq(waybills.entryMode, entryMode))
  }

  const items = await db
    .select({
      waybillId: waybills.id,
      waybillNumber: waybills.waybillNumber,
      orderReference: waybills.orderReference,
      entryMode: waybills.entryMode,
      customerName: waybills.customerName,
      riderId: users.id,
      riderName: users.name,
      completionTime: waybills.completionTime,
      recipientName: proofOfDeliveries.recipientName,
    })
    .from(waybills)
    .leftJoin(users, eq(users.id, waybills.assignedRiderId))
    .leftJoin(proofOfDeliveries, eq(proofOfDeliveries.waybillId, waybills.id))
    .where(and(...conditions))
    .orderBy(asc(waybills.completionTime))

  const grouped = Object.values(
    items.reduce<Record<string, { riderId: string | null; riderName: string | null; day: string; total: number }>>(
      (accumulator, item) => {
        const day = item.completionTime?.toISOString().slice(0, 10) ?? 'unknown'
        const key = `${item.riderId ?? 'unassigned'}:${day}`
        if (!accumulator[key]) {
          accumulator[key] = {
            riderId: item.riderId,
            riderName: item.riderName,
            day,
            total: 0,
          }
        }
        accumulator[key].total += 1
        return accumulator
      },
      {},
    ),
  )

  return c.json({
    items,
    grouped,
    totals: {
      completedDeliveries: items.length,
      riders: new Set(items.map((item) => item.riderId).filter(Boolean)).size,
    },
  })
})

reportRoutes.get('/billing-summary', async (c) => {
  const start = c.req.query('start')
  const end = c.req.query('end')
  const clientId = c.req.query('client_id')
  const invoiceStatus = c.req.query('invoice_status')
  const entryMode = c.req.query('entry_mode')

  if (!start || !end) {
    throw new AppError(
      400,
      'invalid_query',
      'Both start and end query parameters are required.',
    )
  }

  const startDate = new Date(`${start}T00:00:00.000Z`)
  const endDate = new Date(`${end}T23:59:59.999Z`)

  if (Number.isNaN(startDate.valueOf()) || Number.isNaN(endDate.valueOf())) {
    throw new AppError(
      400,
      'invalid_query',
      'start and end must be valid YYYY-MM-DD values.',
    )
  }

  const conditions = [
    eq(waybills.status, 'delivered'),
    gte(waybills.completionTime, startDate),
    lte(waybills.completionTime, endDate),
  ]

  if (clientId) {
    conditions.push(eq(waybills.clientId, clientId))
  }

  if (entryMode === 'live' || entryMode === 'historical') {
    conditions.push(eq(waybills.entryMode, entryMode))
  }

  if (invoiceStatus === 'uninvoiced') {
    conditions.push(isNull(invoiceItems.id))
  }

  const items = await db
    .select({
      waybillId: waybills.id,
      waybillNumber: waybills.waybillNumber,
      orderReference: waybills.orderReference,
      entryMode: waybills.entryMode,
      clientId: clients.id,
      clientName: clients.name,
      standardDeliveryRateCents: clients.standardDeliveryRateCents,
      weeklyBandLimit: clients.weeklyBandLimit,
      overflowDeliveryRateCents: clients.overflowDeliveryRateCents,
      customerName: waybills.customerName,
      completionTime: waybills.completionTime,
      invoiceId: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      invoiceAmountCents: invoiceItems.amountCents,
      pricingTier: invoiceItems.pricingTier,
    })
    .from(waybills)
    .leftJoin(clients, eq(clients.id, waybills.clientId))
    .leftJoin(invoiceItems, eq(invoiceItems.waybillId, waybills.id))
    .leftJoin(invoices, eq(invoices.id, invoiceItems.invoiceId))
    .where(and(...conditions))
    .orderBy(asc(waybills.completionTime))

  const clientIds = Array.from(
    new Set(items.map((item) => item.clientId).filter((value): value is string => Boolean(value))),
  )
  const weekStarts = items
    .map((item) => item.completionTime)
    .filter((value): value is Date => Boolean(value))
    .map((value) => startOfBillingWeek(value))

  const chargeMap = new Map<string, ReturnType<typeof calculateDeliveryCharges> extends Map<string, infer Value> ? Value : never>()

  if (clientIds.length > 0 && weekStarts.length > 0) {
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
          eq(waybills.status, 'delivered'),
          gte(waybills.completionTime, billingWindowStart),
          lte(waybills.completionTime, billingWindowEnd),
        ),
      )

    const pricingByClientId = new Map(
      items
        .filter((item): item is typeof item & { clientId: string } => Boolean(item.clientId))
        .map((item) => [
          item.clientId,
          {
            clientId: item.clientId,
            standardDeliveryRateCents: item.standardDeliveryRateCents ?? 0,
            weeklyBandLimit: item.weeklyBandLimit,
            overflowDeliveryRateCents: item.overflowDeliveryRateCents,
          },
        ]),
    )

    const computedCharges = calculateDeliveryCharges(
      deliveredInCoveredWeeks.filter((item) =>
        item.clientId ? pricingByClientId.has(item.clientId) : false),
      pricingByClientId,
    )

    for (const [waybillId, charge] of computedCharges.entries()) {
      chargeMap.set(waybillId, charge)
    }
  }

  const pricedItems = items.map((item) => {
    const charge = chargeMap.get(item.waybillId)
    const deliveryChargeCents =
      item.invoiceAmountCents ??
      charge?.deliveryChargeCents ??
      item.standardDeliveryRateCents ??
      0

    return {
      ...item,
      deliveryChargeCents,
      pricingTier: item.pricingTier ?? charge?.pricingTier ?? 'standard',
    }
  })

  const grouped = Object.values(
    pricedItems.reduce<Record<string, {
      clientId: string | null
      clientName: string | null
      delivered: number
      totalAmountCents: number
      invoicedAmountCents: number
      uninvoicedAmountCents: number
      uninvoicedCount: number
    }>>((accumulator, item) => {
      const key = item.clientId ?? 'unassigned'

      if (!accumulator[key]) {
        accumulator[key] = {
          clientId: item.clientId,
          clientName: item.clientName,
          delivered: 0,
          totalAmountCents: 0,
          invoicedAmountCents: 0,
          uninvoicedAmountCents: 0,
          uninvoicedCount: 0,
        }
      }

      accumulator[key].delivered += 1
      accumulator[key].totalAmountCents += item.deliveryChargeCents

      if (item.invoiceId) {
        accumulator[key].invoicedAmountCents += item.deliveryChargeCents
      } else {
        accumulator[key].uninvoicedAmountCents += item.deliveryChargeCents
        accumulator[key].uninvoicedCount += 1
      }

      return accumulator
    }, {}),
  )

  return c.json({
    items: pricedItems,
    grouped,
    totals: {
      deliveredWaybills: pricedItems.length,
      totalAmountCents: pricedItems.reduce((sum, item) => sum + item.deliveryChargeCents, 0),
      uninvoicedAmountCents: pricedItems.reduce(
        (sum, item) => sum + (item.invoiceId ? 0 : item.deliveryChargeCents),
        0,
      ),
      clients: new Set(pricedItems.map((item) => item.clientId).filter(Boolean)).size,
    },
  })
})
