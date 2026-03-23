import { Hono } from 'hono'
import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/client'
import { clients, users } from '../db/schema'
import { requireAuth, requireRole, type AppVariables } from '../lib/auth'
import { AppError, assert } from '../lib/errors'
import { parseJson } from '../lib/http'
import { decodeImageDataUrl } from '../lib/image'
import { uploadProfileImageFile } from '../lib/storage'
import {
  ghanaPhoneField,
  optionalImageDataUrlField,
  optionalNullableAddressField,
  optionalGhanaPhoneField,
  optionalNullableId,
  optionalNullableText,
  requiredText,
} from '../lib/validation'

const createUserSchema = z.object({
  name: requiredText('Full name', 2),
  phone: ghanaPhoneField('Phone number'),
  role: z.enum(['admin', 'ops', 'rider'], {
    error: 'User role must be admin, ops, or rider.',
  }),
  password: requiredText('Password', 6),
  active: z.boolean().optional().default(true),
  profileImageDataUrl: optionalImageDataUrlField('Profile image'),
  defaultClientId: optionalNullableId('Default client'),
  vehicleType: optionalNullableText('Vehicle type', 2),
  vehiclePlateNumber: optionalNullableText('Vehicle plate number', 2),
  licenseNumber: optionalNullableText('License number', 2),
  address: optionalNullableAddressField('Address', 5),
  notes: optionalNullableText('Notes', 2),
})

const updateUserSchema = z.object({
  name: requiredText('Full name', 2).optional(),
  phone: optionalGhanaPhoneField('Phone number'),
  role: z
    .enum(['admin', 'ops', 'rider'], {
      error: 'User role must be admin, ops, or rider.',
    })
    .optional(),
  password: requiredText('Password', 6).optional(),
  active: z.boolean().optional(),
  profileImageDataUrl: optionalImageDataUrlField('Profile image').nullable(),
  defaultClientId: optionalNullableId('Default client'),
  vehicleType: optionalNullableText('Vehicle type', 2),
  vehiclePlateNumber: optionalNullableText('Vehicle plate number', 2),
  licenseNumber: optionalNullableText('License number', 2),
  address: optionalNullableAddressField('Address', 5),
  notes: optionalNullableText('Notes', 2),
})

type PublicUser = {
  id: string
  name: string
  phone: string
  role: 'admin' | 'ops' | 'rider'
  active: boolean
  profileImageUrl: string | null
  profileImageMimeType: string | null
  defaultClientId: string | null
  vehicleType: string | null
  vehiclePlateNumber: string | null
  licenseNumber: string | null
  address: string | null
  notes: string | null
  createdAt?: Date
}

function toUserResponse(user: PublicUser) {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    active: user.active,
    profileImageUrl: user.profileImageUrl,
    profileImageMimeType: user.profileImageMimeType,
    defaultClientId: user.defaultClientId,
    vehicleType: user.vehicleType,
    vehiclePlateNumber: user.vehiclePlateNumber,
    licenseNumber: user.licenseNumber,
    address: user.address,
    notes: user.notes,
    createdAt: user.createdAt,
  }
}

export const userRoutes = new Hono<{ Variables: AppVariables }>()

userRoutes.use('*', requireAuth)

userRoutes.get('/', async (c) => {
  const currentUser = c.get('user')
  const role = c.req.query('role')
  const active = c.req.query('active')
  const conditions = []

  if (currentUser.role === 'rider') {
    assert(
      role === 'rider',
      new AppError(403, 'forbidden', 'Riders can only view rider accounts.'),
    )
  }

  if (role) {
    conditions.push(eq(users.role, role as 'admin' | 'ops' | 'rider'))
  }

  if (active === 'true' || active === 'false') {
    conditions.push(eq(users.active, active === 'true'))
  }

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      phone: users.phone,
      role: users.role,
      active: users.active,
      profileImageUrl: users.profileImageUrl,
      profileImageMimeType: users.profileImageMimeType,
      defaultClientId: users.defaultClientId,
      vehicleType: users.vehicleType,
      vehiclePlateNumber: users.vehiclePlateNumber,
      licenseNumber: users.licenseNumber,
      address: users.address,
      notes: users.notes,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(users.role), asc(users.name))

  return c.json({ items: rows, total: rows.length })
})

userRoutes.post('/', requireRole(['admin', 'ops']), async (c) => {
  const currentUser = c.get('user')
  const input = await parseJson(c, createUserSchema.parse)
  assert(
    currentUser.role === 'admin' || input.role === 'rider',
    new AppError(
      403,
      'forbidden',
      'Ops can only create rider accounts.',
    ),
  )
  const existing = await db.query.users.findFirst({
    where: eq(users.phone, input.phone),
  })

  assert(
    !existing,
    new AppError(409, 'user_exists', 'A user with that phone already exists.'),
  )

  const passwordHash = await Bun.password.hash(input.password)
  let profileImageUrl: string | null = null
  let profileImageMimeType: string | null = null

  if (input.defaultClientId) {
    const client = await db.query.clients.findFirst({
      where: eq(clients.id, input.defaultClientId),
    })
    assert(client, new AppError(404, 'not_found', 'Default client not found.'))
  }

  if (input.profileImageDataUrl) {
    const image = decodeImageDataUrl(input.profileImageDataUrl)
    profileImageUrl = await uploadProfileImageFile({
      bytes: image.bytes,
      mimeType: image.mimeType,
      path: `users/${crypto.randomUUID()}/profile.${image.extension}`,
    })
    profileImageMimeType = image.mimeType
  }

  const user = {
    id: crypto.randomUUID(),
    name: input.name,
    phone: input.phone,
    role: input.role,
    active: input.active,
    passwordHash,
    profileImageUrl,
    profileImageMimeType,
    defaultClientId: input.defaultClientId ?? null,
    vehicleType: input.vehicleType ?? null,
    vehiclePlateNumber: input.vehiclePlateNumber ?? null,
    licenseNumber: input.licenseNumber ?? null,
    address: input.address ?? null,
    notes: input.notes ?? null,
  }

  await db.insert(users).values(user)

  return c.json(
    {
      user: toUserResponse({
        ...user,
        createdAt: new Date(),
      }),
    },
    201,
  )
})

userRoutes.patch('/:id', requireRole(['admin', 'ops']), async (c) => {
  const currentUser = c.get('user')
  const userId = c.req.param('id')
  const input = await parseJson(c, updateUserSchema.parse)
  const existing = await db.query.users.findFirst({
    where: eq(users.id, userId),
  })

  assert(existing, new AppError(404, 'not_found', 'User not found.'))
  assert(
    currentUser.role === 'admin' || existing.role === 'rider',
    new AppError(
      403,
      'forbidden',
      'Ops can only update rider accounts.',
    ),
  )
  assert(
    currentUser.role === 'admin' || input.role === undefined || input.role === 'rider',
    new AppError(
      403,
      'forbidden',
      'Ops can only keep rider accounts in the rider role.',
    ),
  )

  const changes: Partial<typeof users.$inferInsert> = {}

  if (input.name !== undefined) changes.name = input.name
  if (input.phone !== undefined) changes.phone = input.phone
  if (input.role !== undefined) changes.role = input.role
  if (input.active !== undefined) changes.active = input.active
  if (input.defaultClientId !== undefined) {
    if (input.defaultClientId) {
      const client = await db.query.clients.findFirst({
        where: eq(clients.id, input.defaultClientId),
      })
      assert(client, new AppError(404, 'not_found', 'Default client not found.'))
    }

    changes.defaultClientId = input.defaultClientId
  }
  if (input.password) changes.passwordHash = await Bun.password.hash(input.password)
  if (input.vehicleType !== undefined) changes.vehicleType = input.vehicleType
  if (input.vehiclePlateNumber !== undefined) {
    changes.vehiclePlateNumber = input.vehiclePlateNumber
  }
  if (input.licenseNumber !== undefined) changes.licenseNumber = input.licenseNumber
  if (input.address !== undefined) changes.address = input.address
  if (input.notes !== undefined) changes.notes = input.notes

  if (input.profileImageDataUrl !== undefined) {
    if (input.profileImageDataUrl === null) {
      changes.profileImageUrl = null
      changes.profileImageMimeType = null
    } else {
      const image = decodeImageDataUrl(input.profileImageDataUrl)
      changes.profileImageUrl = await uploadProfileImageFile({
        bytes: image.bytes,
        mimeType: image.mimeType,
        path: `users/${userId}/profile.${image.extension}`,
      })
      changes.profileImageMimeType = image.mimeType
    }
  }

  await db.update(users).set(changes).where(eq(users.id, userId))

  const updated = await db.query.users.findFirst({
    where: eq(users.id, userId),
  })

  return c.json({
    user: toUserResponse(updated!),
  })
})
