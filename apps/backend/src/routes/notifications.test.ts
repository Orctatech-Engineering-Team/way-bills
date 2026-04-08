import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { Hono } from 'hono'

type NotificationRecord = {
  id: string
  title: string
  message: string
  type: string
  linkPath: string
  eventKey: string
  readAt: string | null
  createdAt: string
  updatedAt: string
}

const listNotificationsForUser = mock<(_: string, __?: unknown) => Promise<NotificationRecord[]>>(
  async () => [],
)
const countUnreadNotificationsForUser = mock<(_: string) => Promise<number>>(async () => 0)
const markNotificationRead = mock<(_: string, __: string) => Promise<void>>(async () => {})
const markAllNotificationsRead = mock<(_: string) => Promise<void>>(async () => {})

mock.module('../lib/auth', () => ({
  requireAuth: async (c: any, next: () => Promise<void>) => {
    c.set('user', { id: 'user-1', role: 'admin' })
    await next()
  },
}))

mock.module('../lib/notifications', () => ({
  listNotificationsForUser,
  countUnreadNotificationsForUser,
  markNotificationRead,
  markAllNotificationsRead,
}))

const { notificationRoutes } = await import('./notifications')

describe('notification routes', () => {
  beforeEach(() => {
    listNotificationsForUser.mockReset()
    countUnreadNotificationsForUser.mockReset()
    markNotificationRead.mockReset()
    markAllNotificationsRead.mockReset()
  })

  test('lists notifications with unread filters and total unread count', async () => {
    listNotificationsForUser.mockResolvedValueOnce([
      {
        id: 'notif-1',
        title: 'Invoice ready',
        message: 'Weekly invoice is ready.',
        type: 'invoice_ready',
        linkPath: '/ops/invoices',
        eventKey: 'invoice_ready:1',
        readAt: null,
        createdAt: '2026-03-22T10:00:00.000Z',
        updatedAt: '2026-03-22T10:00:00.000Z',
      },
    ])
    countUnreadNotificationsForUser.mockResolvedValueOnce(4)

    const app = new Hono()
    app.route('/notifications', notificationRoutes)

    const response = await app.request('/notifications?unread_only=true&limit=5')

    expect(response.status).toBe(200)
    expect(listNotificationsForUser).toHaveBeenCalledWith('user-1', {
      unreadOnly: true,
      limit: 5,
    })
    expect(countUnreadNotificationsForUser).toHaveBeenCalledWith('user-1')
    expect(response.json()).resolves.toEqual({
      items: [
        {
          id: 'notif-1',
          title: 'Invoice ready',
          message: 'Weekly invoice is ready.',
          type: 'invoice_ready',
          linkPath: '/ops/invoices',
          eventKey: 'invoice_ready:1',
          readAt: null,
          createdAt: '2026-03-22T10:00:00.000Z',
          updatedAt: '2026-03-22T10:00:00.000Z',
        },
      ],
      unreadCount: 4,
    })
  })

  test('marks all notifications read and returns refreshed items', async () => {
    listNotificationsForUser.mockResolvedValueOnce([
      {
        id: 'notif-2',
        title: 'Shift handover',
        message: 'Accept the incoming handover.',
        type: 'shift_handover_pending',
        linkPath: '/rider/jobs',
        eventKey: 'shift_handover_pending:1',
        readAt: '2026-03-22T10:30:00.000Z',
        createdAt: '2026-03-22T10:00:00.000Z',
        updatedAt: '2026-03-22T10:30:00.000Z',
      },
    ])
    countUnreadNotificationsForUser.mockResolvedValueOnce(0)

    const app = new Hono()
    app.route('/notifications', notificationRoutes)

    const response = await app.request('/notifications/read-all', {
      method: 'POST',
    })

    expect(response.status).toBe(200)
    expect(markAllNotificationsRead).toHaveBeenCalledWith('user-1')
    expect(listNotificationsForUser).toHaveBeenCalledWith('user-1', { limit: 12 })
    expect(response.json()).resolves.toEqual({
      items: [
        {
          id: 'notif-2',
          title: 'Shift handover',
          message: 'Accept the incoming handover.',
          type: 'shift_handover_pending',
          linkPath: '/rider/jobs',
          eventKey: 'shift_handover_pending:1',
          readAt: '2026-03-22T10:30:00.000Z',
          createdAt: '2026-03-22T10:00:00.000Z',
          updatedAt: '2026-03-22T10:30:00.000Z',
        },
      ],
      unreadCount: 0,
    })
  })

  test('marks a single notification read and refreshes the list', async () => {
    listNotificationsForUser.mockResolvedValueOnce([])
    countUnreadNotificationsForUser.mockResolvedValueOnce(1)

    const app = new Hono()
    app.route('/notifications', notificationRoutes)

    const response = await app.request('/notifications/notif-3/read', {
      method: 'POST',
    })

    expect(response.status).toBe(200)
    expect(markNotificationRead).toHaveBeenCalledWith('notif-3', 'user-1')
    expect(response.json()).resolves.toEqual({
      items: [],
      unreadCount: 1,
    })
  })
})
