// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ProtectedScreen } from './AppLayout'

const navigate = vi.fn()
const showToast = vi.fn()
const listNotifications = vi.fn()
const markNotificationRead = vi.fn()
const markAllNotificationsRead = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    className,
    onClick,
  }: {
    children: React.ReactNode
    to: string
    className?: string
    onClick?: () => void
  }) => (
    <a href={to} className={className} onClick={onClick}>
      {children}
    </a>
  ),
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate">{to}</div>,
  useNavigate: () => navigate,
  useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => string }) =>
    select({ location: { pathname: '/ops/waybills' } }),
}))

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({
    loading: false,
    user: {
      id: 'user-1',
      name: 'Admin User',
      phone: '+233241234567',
      role: 'admin',
    },
    logout: vi.fn(async () => {}),
  }),
}))

vi.mock('../theme/ThemeProvider', () => ({
  useTheme: () => ({
    theme: 'orcta',
    options: [
      { id: 'orcta', label: 'Orcta', swatches: ['#111', '#222', '#333'] },
      { id: 'monochrome', label: 'Monochrome', swatches: ['#444', '#555', '#666'] },
    ],
    setTheme: vi.fn(),
  }),
}))

vi.mock('../feedback/ToastProvider', () => ({
  useToast: () => ({
    showToast,
  }),
}))

vi.mock('../lib/api', () => ({
  api: {
    listNotifications: (...args: unknown[]) => listNotifications(...args),
    markNotificationRead: (...args: unknown[]) => markNotificationRead(...args),
    markAllNotificationsRead: (...args: unknown[]) => markAllNotificationsRead(...args),
  },
}))

describe('ProtectedScreen notifications', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  beforeEach(() => {
    navigate.mockReset()
    showToast.mockReset()
    listNotifications.mockReset()
    markNotificationRead.mockReset()
    markAllNotificationsRead.mockReset()
  })

  test('shows unread badge, opens notifications, and marks an item read before navigating', async () => {
    listNotifications
      .mockResolvedValueOnce({
        items: [
          {
            id: 'notif-1',
            type: 'failed_delivery',
            title: 'Delivery failed',
            message: 'Follow up with the rider on WB-20260322-2.',
            linkPath: '/ops/waybills/waybill-1',
            eventKey: 'failed_delivery:waybill-1',
            readAt: null,
            createdAt: '2026-03-22T12:00:00.000Z',
            updatedAt: '2026-03-22T12:00:00.000Z',
          },
        ],
        unreadCount: 1,
      })
      .mockResolvedValueOnce({
        items: [
          {
            id: 'notif-1',
            type: 'failed_delivery',
            title: 'Delivery failed',
            message: 'Follow up with the rider on WB-20260322-2.',
            linkPath: '/ops/waybills/waybill-1',
            eventKey: 'failed_delivery:waybill-1',
            readAt: null,
            createdAt: '2026-03-22T12:00:00.000Z',
            updatedAt: '2026-03-22T12:00:00.000Z',
          },
        ],
        unreadCount: 1,
      })

    markNotificationRead.mockResolvedValueOnce({
      items: [
        {
          id: 'notif-1',
          type: 'failed_delivery',
          title: 'Delivery failed',
          message: 'Follow up with the rider on WB-20260322-2.',
          linkPath: '/ops/waybills/waybill-1',
          eventKey: 'failed_delivery:waybill-1',
          readAt: '2026-03-22T12:05:00.000Z',
          createdAt: '2026-03-22T12:00:00.000Z',
          updatedAt: '2026-03-22T12:05:00.000Z',
        },
      ],
      unreadCount: 0,
    })

    render(
      <ProtectedScreen roles={['admin']} title="Waybills">
        <div>Content</div>
      </ProtectedScreen>,
    )

    await waitFor(() => {
      expect(listNotifications).toHaveBeenCalledWith({ limit: 12 })
    })

    const bellButton = (await screen.findAllByLabelText('1 unread notifications'))[0]
    fireEvent.click(bellButton)

    expect(listNotifications).toHaveBeenLastCalledWith({ limit: 12 })
    expect((await screen.findAllByText('Delivery failed')).length).toBeGreaterThan(0)
    expect(
      screen.getAllByText('Follow up with the rider on WB-20260322-2.').length,
    ).toBeGreaterThan(0)

    fireEvent.click(screen.getAllByRole('menuitem', { name: /delivery failed/i })[0]!)

    await waitFor(() => {
      expect(markNotificationRead).toHaveBeenCalledWith('notif-1')
    })
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({ to: '/ops/waybills/waybill-1' })
    })
  })

  test('marks all notifications read from the dropdown', async () => {
    listNotifications.mockResolvedValue({
      items: [
        {
          id: 'notif-2',
          type: 'invoice_ready',
          title: 'Invoice ready',
          message: 'A weekly invoice is ready to send.',
          linkPath: '/ops/invoices',
          eventKey: 'invoice_ready:invoice-1',
          readAt: null,
          createdAt: '2026-03-22T12:00:00.000Z',
          updatedAt: '2026-03-22T12:00:00.000Z',
        },
      ],
      unreadCount: 1,
    })

    markAllNotificationsRead.mockResolvedValueOnce({
      items: [
        {
          id: 'notif-2',
          type: 'invoice_ready',
          title: 'Invoice ready',
          message: 'A weekly invoice is ready to send.',
          linkPath: '/ops/invoices',
          eventKey: 'invoice_ready:invoice-1',
          readAt: '2026-03-22T12:10:00.000Z',
          createdAt: '2026-03-22T12:00:00.000Z',
          updatedAt: '2026-03-22T12:10:00.000Z',
        },
      ],
      unreadCount: 0,
    })

    render(
      <ProtectedScreen roles={['admin']} title="Waybills">
        <div>Content</div>
      </ProtectedScreen>,
    )

    const bellButton = (await screen.findAllByLabelText('1 unread notifications'))[0]
    fireEvent.click(bellButton)

    fireEvent.click(await screen.findByRole('button', { name: /mark all read/i }))

    await waitFor(() => {
      expect(markAllNotificationsRead).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(screen.getAllByLabelText('Open notifications').length).toBeGreaterThan(0)
    })
  })
})
