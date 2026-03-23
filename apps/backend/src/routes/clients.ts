import { Hono } from 'hono'
import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/client'
import { clients } from '../db/schema'
import { requireAuth, requireRole, type AppVariables } from '../lib/auth'
import { AppError, assert } from '../lib/errors'
import { parseJson } from '../lib/http'
import {
  addressField,
  optionalNullableGhanaPhoneField,
  optionalNullableText,
  requiredText,
} from '../lib/validation'

const clientSchema = z.object({
  name: requiredText('Client name', 2),
  contactName: optionalNullableText('Contact name', 2),
  contactPhone: optionalNullableGhanaPhoneField('Contact phone'),
  contactEmail: z
    .string()
    .trim()
    .email('Contact email must be a valid email address.')
    .nullable()
    .optional(),
  billingAddress: addressField('Billing address', 5),
  currency: z
    .string()
    .trim()
    .length(3, 'Currency must be a 3-letter code.')
    .optional()
    .default('GHS'),
  paymentTermsDays: z
    .number()
    .int('Payment terms must be a whole number of days.')
    .min(0, 'Payment terms cannot be negative.')
    .max(90, 'Payment terms cannot be more than 90 days.')
    .optional()
    .default(7),
  standardDeliveryRateCents: z
    .number()
    .int('Standard delivery rate must be a whole number.')
    .min(0, 'Standard delivery rate cannot be negative.')
    .optional()
    .default(0),
  weeklyBandLimit: z
    .number()
    .int('Weekly band limit must be a whole number.')
    .min(0, 'Weekly band limit cannot be negative.')
    .max(1000, 'Weekly band limit cannot be more than 1000 deliveries.')
    .nullable()
    .optional(),
  overflowDeliveryRateCents: z
    .number()
    .int('Overflow delivery rate must be a whole number.')
    .min(0, 'Overflow delivery rate cannot be negative.')
    .nullable()
    .optional(),
  active: z.boolean().optional().default(true),
})

const updateClientSchema = clientSchema.partial()

export const clientRoutes = new Hono<{ Variables: AppVariables }>()
clientRoutes.use('*', requireAuth)

clientRoutes.get('/', async (c) => {
  const active = c.req.query('active')
  const conditions = []

  if (active === 'true' || active === 'false') {
    conditions.push(eq(clients.active, active === 'true'))
  }

  const items = await db
    .select()
    .from(clients)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(clients.name))

  return c.json({ items, total: items.length })
})

clientRoutes.post('/', requireRole(['admin', 'ops']), async (c) => {
  const input = await parseJson(c, clientSchema.parse)
  const existing = await db.query.clients.findFirst({
    where: eq(clients.name, input.name),
  })

  assert(
    !existing,
    new AppError(409, 'client_exists', 'A client with that name already exists.'),
  )

  const client = {
    id: crypto.randomUUID(),
    name: input.name,
    contactName: input.contactName ?? null,
    contactPhone: input.contactPhone ?? null,
    contactEmail: input.contactEmail ?? null,
    billingAddress: input.billingAddress,
    currency: input.currency.toUpperCase(),
    paymentTermsDays: input.paymentTermsDays,
    standardDeliveryRateCents: input.standardDeliveryRateCents,
    weeklyBandLimit: input.weeklyBandLimit ?? null,
    overflowDeliveryRateCents: input.overflowDeliveryRateCents ?? null,
    active: input.active,
    createdAt: new Date(),
  }

  await db.insert(clients).values(client)
  return c.json({ client }, 201)
})

clientRoutes.patch('/:id', requireRole(['admin', 'ops']), async (c) => {
  const clientId = c.req.param('id')
  const input = await parseJson(c, updateClientSchema.parse)
  const existing = await db.query.clients.findFirst({
    where: eq(clients.id, clientId),
  })

  assert(existing, new AppError(404, 'not_found', 'Client not found.'))

  const changes: Partial<typeof clients.$inferInsert> = {}

  if (input.name !== undefined) changes.name = input.name
  if (input.contactName !== undefined) changes.contactName = input.contactName
  if (input.contactPhone !== undefined) changes.contactPhone = input.contactPhone
  if (input.contactEmail !== undefined) changes.contactEmail = input.contactEmail
  if (input.billingAddress !== undefined) changes.billingAddress = input.billingAddress
  if (input.currency !== undefined) changes.currency = input.currency.toUpperCase()
  if (input.paymentTermsDays !== undefined) changes.paymentTermsDays = input.paymentTermsDays
  if (input.standardDeliveryRateCents !== undefined) {
    changes.standardDeliveryRateCents = input.standardDeliveryRateCents
  }
  if (input.weeklyBandLimit !== undefined) changes.weeklyBandLimit = input.weeklyBandLimit
  if (input.overflowDeliveryRateCents !== undefined) {
    changes.overflowDeliveryRateCents = input.overflowDeliveryRateCents
  }
  if (input.active !== undefined) changes.active = input.active

  await db.update(clients).set(changes).where(eq(clients.id, clientId))
  const client = await db.query.clients.findFirst({ where: eq(clients.id, clientId) })

  return c.json({ client })
})
