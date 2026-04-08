import { Hono } from 'hono'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/client'
import { clients, invoices, type InvoiceStatus } from '../db/schema'
import { requireAuth, requireRole, type AppVariables } from '../lib/auth'
import { AppError, assert } from '../lib/errors'
import { getInvoiceAutomationStatus } from '../lib/automation-status'
import { parseJson } from '../lib/http'
import {
  createInvoiceForWindow,
  getInvoiceDetail,
  invoiceWindowFromDateRange,
  serializeInvoiceDetail,
  toInvoicePdfDetail,
} from '../lib/invoices'
import { buildInvoicePdf } from '../lib/pdf'
import { sendInvoiceEmail } from '../lib/invoice-email'
import { dateOnlyField, optionalNullableText, requiredId } from '../lib/validation'

const createInvoiceSchema = z.object({
  clientId: requiredId('Client'),
  start: dateOnlyField('Invoice start date'),
  end: dateOnlyField('Invoice end date'),
  dueDate: dateOnlyField('Invoice due date').optional(),
  notes: optionalNullableText('Notes', 2),
})

const updateInvoiceStatusSchema = z.object({
  status: z.enum(['paid', 'void'], {
    error: 'Invoice status must be paid or void.',
  }),
})

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
      source: invoices.source,
      emailStatus: invoices.emailStatus,
      emailSentAt: invoices.emailSentAt,
      emailDeliveryAttempts: invoices.emailDeliveryAttempts,
      lastEmailError: invoices.lastEmailError,
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

invoiceRoutes.get('/automation-status', async (c) => {
  const status = await getInvoiceAutomationStatus()
  return c.json({ status })
})

invoiceRoutes.get('/:id', async (c) => {
  const detail = await getInvoiceDetail(c.req.param('id'))
  return c.json({ invoice: serializeInvoiceDetail(detail) })
})

invoiceRoutes.post('/', async (c) => {
  const currentUser = c.get('user')
  const input = await parseJson(c, createInvoiceSchema.parse)
  const { periodStart, periodEnd } = invoiceWindowFromDateRange(input.start, input.end)
  const dueAt = input.dueDate
    ? new Date(`${input.dueDate}T23:59:59.999Z`)
    : null

  const result = await createInvoiceForWindow({
    clientId: input.clientId,
    periodStart,
    periodEnd,
    dueAt,
    notes: input.notes ?? null,
    createdBy: currentUser.id,
    source: 'manual',
  })

  return c.json({ invoice: serializeInvoiceDetail(result.invoice) }, 201)
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

invoiceRoutes.post('/:id/send-email', async (c) => {
  const response = await sendInvoiceEmail(c.req.param('id'))
  return c.json(response)
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
