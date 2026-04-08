import { and, count, desc, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '../db/client'
import { notifications, users, type NotificationType } from '../db/schema'

type NotificationInput = {
  userId: string
  type: NotificationType
  title: string
  message: string
  linkPath?: string | null
  eventKey?: string | null
}

export function serializeNotification(item: typeof notifications.$inferSelect) {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    message: item.message,
    linkPath: item.linkPath,
    eventKey: item.eventKey,
    readAt: item.readAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }
}

export async function createUserNotification(input: NotificationInput) {
  const now = new Date()

  if (input.eventKey) {
    const existing = await db.query.notifications.findFirst({
      where: and(
        eq(notifications.userId, input.userId),
        eq(notifications.eventKey, input.eventKey),
      ),
    })

    if (existing) {
      await db
        .update(notifications)
        .set({
          type: input.type,
          title: input.title,
          message: input.message,
          linkPath: input.linkPath ?? null,
          readAt: null,
          updatedAt: now,
        })
        .where(eq(notifications.id, existing.id))

      return
    }
  }

  await db.insert(notifications).values({
    id: crypto.randomUUID(),
    userId: input.userId,
    type: input.type,
    title: input.title,
    message: input.message,
    linkPath: input.linkPath ?? null,
    eventKey: input.eventKey ?? null,
    readAt: null,
    createdAt: now,
    updatedAt: now,
  })
}

export async function createRoleNotifications(
  roles: Array<'admin' | 'ops' | 'rider'>,
  input: Omit<NotificationInput, 'userId'>,
) {
  const recipients = await db.query.users.findMany({
    where: inArray(users.role, roles),
  })

  await Promise.all(
    recipients
      .filter((user) => user.active)
      .map((user) =>
        createUserNotification({
          userId: user.id,
          ...input,
        }),
      ),
  )
}

export async function listNotificationsForUser(userId: string, options?: {
  unreadOnly?: boolean
  limit?: number
}) {
  const limit = Math.max(1, Math.min(options?.limit ?? 12, 50))

  const items = await db.query.notifications.findMany({
    where: options?.unreadOnly
      ? and(eq(notifications.userId, userId), isNull(notifications.readAt))
      : eq(notifications.userId, userId),
    orderBy: [desc(notifications.updatedAt)],
    limit,
  })

  return items.map(serializeNotification)
}

export async function countUnreadNotificationsForUser(userId: string) {
  const [result] = await db
    .select({ value: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))

  return Number(result?.value ?? 0)
}

export async function markNotificationRead(id: string, userId: string) {
  await db
    .update(notifications)
    .set({
      readAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
}

export async function markAllNotificationsRead(userId: string) {
  await db
    .update(notifications)
    .set({
      readAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
}
