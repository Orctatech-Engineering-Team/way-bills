import { Hono } from 'hono'
import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/client'
import { clients } from '../db/schema'
import { requireAuth, requireRole, type AppVariables } from '../lib/auth'
import { AppError, assert } from '../lib/errors'
import { parseJson } from '../lib/http'

const clientSchema = z.object({
  name: z.string().min(2),
  contactName: z.string().min(2).nullable().optional(),
  contactPhone: z.string().min(3).nullable().optional(),
  contactEmail: z.email().nullable().optional(),
  billingAddress: z.string().min(5),
  currency: z.string().min(3).max(3).optional().default('GHS'),
  paymentTermsDays: z.number().int().min(0).max(90).optional().default(7),
  standardDeliveryRateCents: z.number().int().min(0).optional().default(0),
  weeklyBandLimit: z.number().int().min(0).max(1000).nullable().optional(),
  overflowDeliveryRateCents: z.number().int().min(0).nullable().optional(),
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
