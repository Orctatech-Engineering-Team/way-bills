import { Hono } from 'hono'
import { z } from 'zod'
import { requireAuth, type AppVariables } from '../lib/auth'
import {
  countUnreadNotificationsForUser,
  listNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
} from '../lib/notifications'
import { parseInput } from '../lib/http'

const listQuerySchema = z.object({
  unreadOnly: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
})

export const notificationRoutes = new Hono<{ Variables: AppVariables }>()
notificationRoutes.use('*', requireAuth)

notificationRoutes.get('/', async (c) => {
  const currentUser = c.get('user')
  const query = parseInput(listQuerySchema.parse, {
    unreadOnly: c.req.query('unread_only') ?? undefined,
    limit: c.req.query('limit') ?? undefined,
  })

  const items = await listNotificationsForUser(currentUser.id, {
    unreadOnly: query.unreadOnly === 'true',
    limit: query.limit,
  })
  const unreadCount = await countUnreadNotificationsForUser(currentUser.id)

  return c.json({
    items,
    unreadCount,
  })
})

notificationRoutes.post('/:id/read', async (c) => {
  const currentUser = c.get('user')
  await markNotificationRead(c.req.param('id'), currentUser.id)
  const items = await listNotificationsForUser(currentUser.id, { limit: 12 })
  const unreadCount = await countUnreadNotificationsForUser(currentUser.id)
  return c.json({
    items,
    unreadCount,
  })
})

notificationRoutes.post('/read-all', async (c) => {
  const currentUser = c.get('user')
  await markAllNotificationsRead(currentUser.id)
  const items = await listNotificationsForUser(currentUser.id, { limit: 12 })
  const unreadCount = await countUnreadNotificationsForUser(currentUser.id)
  return c.json({
    items,
    unreadCount,
  })
})
