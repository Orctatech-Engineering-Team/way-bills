import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/client'
import { users } from '../db/schema'
import {
  clearSessionCookie,
  createSessionToken,
  readSessionUser,
  setSessionCookie,
  type AppVariables,
} from '../lib/auth'
import { AppError, assert } from '../lib/errors'
import { parseJson } from '../lib/http'
import { ghanaPhoneField, requiredText } from '../lib/validation'

const loginSchema = z.object({
  phone: ghanaPhoneField('Phone number'),
  password: requiredText('Password', 6),
})

export const authRoutes = new Hono<{ Variables: AppVariables }>()

function toAuthUser(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    active: user.active,
    defaultClientId: user.defaultClientId,
    profileImageUrl: user.profileImageUrl,
    profileImageMimeType: user.profileImageMimeType,
    vehicleType: user.vehicleType,
    vehiclePlateNumber: user.vehiclePlateNumber,
    licenseNumber: user.licenseNumber,
    address: user.address,
    notes: user.notes,
  }
}

authRoutes.post('/login', async (c) => {
  const input = await parseJson(c, loginSchema.parse)
  const user = await db.query.users.findFirst({
    where: eq(users.phone, input.phone),
  })

  assert(
    user && user.active,
    new AppError(401, 'invalid_credentials', 'Invalid phone or password.'),
  )

  const valid = await Bun.password.verify(input.password, user.passwordHash)
  assert(
    valid,
    new AppError(401, 'invalid_credentials', 'Invalid phone or password.'),
  )

  const token = await createSessionToken({
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
  })

  setSessionCookie(c, token)

  return c.json({
    user: toAuthUser(user),
  })
})

authRoutes.post('/logout', async (c) => {
  clearSessionCookie(c)
  return c.json({ success: true })
})

authRoutes.get('/me', async (c) => {
  const user = await readSessionUser(c)
  if (!user) {
    return c.json({ user: null }, 401)
  }

  const fullUser = await db.query.users.findFirst({
    where: eq(users.id, user.id),
  })

  assert(fullUser, new AppError(401, 'unauthorized', 'Authentication required.'))

  return c.json({ user: toAuthUser(fullUser) })
})
