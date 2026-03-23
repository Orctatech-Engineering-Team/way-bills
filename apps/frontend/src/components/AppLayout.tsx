import { Link, Navigate, useNavigate, useRouterState } from '@tanstack/react-router'
import { Bell, ChevronDown, LogOut, Menu, Package2, Palette, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useToast } from '../feedback/ToastProvider'
import { formatGhanaPhoneForDisplay } from '../lib/contact'
import { api } from '../lib/api'
import type { AppNotification, UserRole } from '../lib/types'
import { defaultRouteForRole, formatDateTime } from '../lib/utils'
import { useTheme } from '../theme/ThemeProvider'

function navItemsForRole(role: UserRole) {
  if (role === 'rider') {
    return [
      { to: '/rider/jobs', label: 'My Jobs' },
      { to: '/rider/jobs/new', label: 'New Delivery' },
    ]
  }

  const items = [
    { to: '/ops/waybills', label: 'Waybills' },
    { to: '/ops/riders', label: 'Riders' },
    { to: '/ops/clients', label: 'Clients' },
    { to: '/ops/invoices', label: 'Invoices' },
    { to: '/ops/reports', label: 'Reports' },
  ]

  if (role === 'admin') {
    items.push({ to: '/admin/users', label: 'Users' })
    items[1] = { to: '/admin/riders', label: 'Riders' }
  }

  return items
}

function sectionActive(pathname: string, itemTo: string) {
  if (itemTo.endsWith('/new')) {
    return pathname === itemTo
  }

  if (itemTo === '/rider/jobs') {
    return pathname.startsWith(itemTo) && pathname !== '/rider/jobs/new'
  }

  return pathname.startsWith(itemTo)
}

function notificationToneLabel(type: AppNotification['type']) {
  if (type === 'shift_handover_pending') {
    return 'Shift handover'
  }

  if (type === 'failed_delivery') {
    return 'Failed delivery'
  }

  if (type === 'invoice_ready') {
    return 'Invoice ready'
  }

  return 'Email issue'
}

export function ProtectedScreen({
  roles,
  title,
  subtitle,
  actions,
  headerVariant = 'default',
  children,
}: {
  roles: UserRole[]
  title: string
  subtitle?: string
  actions?: ReactNode
  headerVariant?: 'default' | 'compact'
  children: ReactNode
}) {
  const auth = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const theme = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const notificationsRef = useRef<HTMLDivElement | null>(null)

  async function loadNotifications(options?: { silent?: boolean }) {
    if (!auth.user) {
      setNotifications([])
      setUnreadCount(0)
      return
    }

    if (!options?.silent) {
      setNotificationsLoading(true)
    }

    try {
      const response = await api.listNotifications({ limit: 12 })
      setNotifications(response.items)
      setUnreadCount(response.unreadCount)
    } catch (caughtError) {
      if (!options?.silent) {
        showToast({
          tone: 'error',
          title: 'Notifications unavailable',
          message:
            caughtError instanceof Error
              ? caughtError.message
              : 'Unable to load notifications right now.',
        })
      }
    } finally {
      if (!options?.silent) {
        setNotificationsLoading(false)
      }
    }
  }

  async function handleNotificationOpen(item: AppNotification) {
    try {
      if (!item.readAt) {
        const response = await api.markNotificationRead(item.id)
        setNotifications(response.items)
        setUnreadCount(response.unreadCount)
      }
    } catch (caughtError) {
      showToast({
        tone: 'error',
        title: 'Notification update failed',
        message:
          caughtError instanceof Error
            ? caughtError.message
            : 'Unable to update the notification.',
      })
    } finally {
      setNotificationsOpen(false)
      if (item.linkPath) {
        void navigate({ to: item.linkPath as never })
      }
    }
  }

  async function handleMarkAllNotificationsRead() {
    try {
      setNotificationsLoading(true)
      const response = await api.markAllNotificationsRead()
      setNotifications(response.items)
      setUnreadCount(response.unreadCount)
    } catch (caughtError) {
      showToast({
        tone: 'error',
        title: 'Notifications update failed',
        message:
          caughtError instanceof Error
            ? caughtError.message
            : 'Unable to mark notifications as read.',
      })
    } finally {
      setNotificationsLoading(false)
    }
  }

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }

      if (!notificationsRef.current?.contains(event.target as Node)) {
        setNotificationsOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        setNotificationsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  useEffect(() => {
    setMenuOpen(false)
    setNotificationsOpen(false)
    setMobileNavOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!mobileNavOpen) {
      return
    }

    const previousOverflow = document.body.style.overflow

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMobileNavOpen(false)
      }
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleEscape)
    }
  }, [mobileNavOpen])

  useEffect(() => {
    if (!auth.user) {
      setNotifications([])
      setUnreadCount(0)
      return
    }

    let active = true

    async function refreshNotifications() {
      try {
        const response = await api.listNotifications({ limit: 12 })
        if (!active) {
          return
        }

        setNotifications(response.items)
        setUnreadCount(response.unreadCount)
      } catch {
        if (active) {
          setNotifications([])
          setUnreadCount(0)
        }
      }
    }

    void refreshNotifications()
    const interval = window.setInterval(() => {
      void refreshNotifications()
    }, 60000)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [auth.user?.id])

  if (auth.loading) {
    return (
      <div className="min-h-screen bg-slate-100 px-6 py-20 text-center text-slate-500">
        Loading workspace...
      </div>
    )
  }

  if (!auth.user) {
    return <Navigate to="/login" />
  }

  if (!roles.includes(auth.user.role)) {
    return <Navigate to={defaultRouteForRole(auth.user.role)} />
  }

  const navItems = navItemsForRole(auth.user.role)

  return (
    <div className="min-h-screen text-slate-900">
      <div className="workspace-shell">
        <header className="workspace-topbar">
          <div className="workspace-topbar-inner">
            <div className="brand-lockup">
              <div className="brand-mark" aria-hidden="true">
                <Package2 size={16} strokeWidth={2.2} />
              </div>
              <div className="brand-stack">
                <span className="brand-wordmark">Waybill System</span>
                <span className="brand-subtitle">Operations workspace</span>
              </div>
              <div className="brand-nav-shell desktop-nav-shell">
                <nav className="brand-nav">
                  {navItems.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`brand-link ${sectionActive(pathname, item.to) ? 'is-active' : ''}`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </nav>
              </div>
            </div>

            <div className="header-actions">
              {actions ? <div className="topbar-primary-actions desktop-topbar-actions">{actions}</div> : null}

              <div className="account-menu desktop-account-menu" ref={notificationsRef}>
                <button
                  type="button"
                  className="notification-trigger"
                  onClick={() => {
                    const nextOpen = !notificationsOpen
                    setNotificationsOpen(nextOpen)
                    setMenuOpen(false)
                    if (nextOpen) {
                      void loadNotifications()
                    }
                  }}
                  aria-expanded={notificationsOpen}
                  aria-haspopup="menu"
                  aria-label={
                    unreadCount > 0
                      ? `${unreadCount} unread notifications`
                      : 'Open notifications'
                  }
                >
                  <Bell size={17} strokeWidth={2.05} />
                  {unreadCount > 0 ? (
                    <span className="notification-badge">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  ) : null}
                </button>

                {notificationsOpen ? (
                  <div className="notification-dropdown" role="menu">
                    <div className="notification-dropdown-header">
                      <div>
                        <p className="account-dropdown-label">Notifications</p>
                        <p className="notification-dropdown-copy">
                          {unreadCount > 0
                            ? `${unreadCount} unread`
                            : 'All caught up'}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="notification-clear"
                        onClick={() => void handleMarkAllNotificationsRead()}
                        disabled={notificationsLoading || unreadCount === 0}
                      >
                        Mark all read
                      </button>
                    </div>

                    <div className="account-dropdown-divider" />

                    {notifications.length > 0 ? (
                      <div className="notification-list">
                        {notifications.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className={`notification-item ${item.readAt ? '' : 'is-unread'}`}
                            onClick={() => void handleNotificationOpen(item)}
                            role="menuitem"
                          >
                            <div className="notification-item-head">
                              <span className="notification-item-type">
                                {notificationToneLabel(item.type)}
                              </span>
                              {!item.readAt ? (
                                <span className="notification-item-state">New</span>
                              ) : null}
                            </div>
                            <p className="notification-item-title">{item.title}</p>
                            <p className="notification-item-message">{item.message}</p>
                            <p className="notification-item-time">
                              {formatDateTime(item.createdAt)}
                            </p>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="notification-empty">
                        <p className="empty-state-title">No notifications yet</p>
                        <p className="empty-state-copy">
                          New handovers, failed deliveries, and invoice events will
                          appear here.
                        </p>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="account-menu desktop-account-menu" ref={menuRef}>
                <button
                  type="button"
                  className="account-trigger"
                  onClick={() => {
                    setMenuOpen((current) => !current)
                    setNotificationsOpen(false)
                  }}
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                >
                  <span className="identity-role">{auth.user.role}</span>
                  <span className="account-trigger-copy">Workspace</span>
                  <ChevronDown
                    size={16}
                    strokeWidth={2.1}
                    className={`account-chevron ${menuOpen ? 'is-open' : ''}`}
                  />
                </button>

                {menuOpen ? (
                  <div className="account-dropdown" role="menu">
                    <div className="account-dropdown-section">
                      <p className="account-dropdown-label">Signed in as</p>
                      <p className="identity-name">{auth.user.name}</p>
                      <p className="identity-copy">
                        {formatGhanaPhoneForDisplay(auth.user.phone)}
                      </p>
                    </div>
                    <div className="account-dropdown-divider" />
                    <div className="account-dropdown-section">
                      <div className="theme-section-header">
                        <p className="account-dropdown-label">Workspace theme</p>
                        <Palette size={14} strokeWidth={2} />
                      </div>
                      <div className="theme-switcher" role="radiogroup" aria-label="Theme selector">
                        {theme.options.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            className={`theme-chip ${theme.theme === option.id ? 'is-active' : ''}`}
                            onClick={() => theme.setTheme(option.id)}
                            role="radio"
                            aria-checked={theme.theme === option.id}
                            aria-label={option.label}
                            title={option.label}
                          >
                            <span className="theme-chip-swatches" aria-hidden="true">
                              {option.swatches.map((color) => (
                                <span
                                  key={`${option.id}-${color}`}
                                  className="theme-chip-dot"
                                  style={{ backgroundColor: color }}
                                />
                              ))}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="account-dropdown-divider" />
                    <button
                      type="button"
                      onClick={() => void auth.logout()}
                      className="account-dropdown-action"
                      role="menuitem"
                    >
                      <LogOut size={15} strokeWidth={2.1} />
                      Log out
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="mobile-topbar-actions">
                <button
                  type="button"
                  className="notification-trigger"
                  onClick={() => {
                    const nextOpen = !notificationsOpen
                    setNotificationsOpen(nextOpen)
                    if (nextOpen) {
                      void loadNotifications()
                    }
                  }}
                  aria-expanded={notificationsOpen}
                  aria-haspopup="dialog"
                  aria-label={
                    unreadCount > 0
                      ? `${unreadCount} unread notifications`
                      : 'Open notifications'
                  }
                >
                  <Bell size={17} strokeWidth={2.05} />
                  {unreadCount > 0 ? (
                    <span className="notification-badge">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  className="mobile-menu-button"
                  onClick={() => setMobileNavOpen(true)}
                  aria-expanded={mobileNavOpen}
                  aria-haspopup="dialog"
                  aria-label="Open navigation menu"
                >
                  <Menu size={18} strokeWidth={2.2} />
                </button>
              </div>
            </div>
          </div>
        </header>

        {mobileNavOpen ? (
          <div
            className="mobile-nav-backdrop"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          >
            <div
              className="mobile-nav-sheet"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mobile-nav-handle" aria-hidden="true" />
              <div className="mobile-nav-header">
                <div>
                  <p className="mobile-nav-kicker">{auth.user.role}</p>
                  <h3 className="mobile-nav-title">Workspace menu</h3>
                  <p className="mobile-nav-copy">{auth.user.name}</p>
                </div>
                <button
                  type="button"
                  className="mobile-nav-close"
                  onClick={() => setMobileNavOpen(false)}
                  aria-label="Close navigation menu"
                >
                  <X size={18} strokeWidth={2.2} />
                </button>
              </div>

              {actions ? <div className="mobile-nav-action-block">{actions}</div> : null}

              <nav className="mobile-nav-list">
                {navItems.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`mobile-nav-link ${sectionActive(pathname, item.to) ? 'is-active' : ''}`}
                    onClick={() => setMobileNavOpen(false)}
                  >
                    <span>{item.label}</span>
                    <span className="mobile-nav-link-state">
                      {sectionActive(pathname, item.to) ? 'Current' : 'Open'}
                    </span>
                  </Link>
                ))}
              </nav>

              <div className="mobile-nav-session">
                <div className="mobile-nav-session-copy">
                  <span className="identity-role">{auth.user.role}</span>
                  <p className="identity-name">{auth.user.name}</p>
                  <p className="identity-copy">
                    {formatGhanaPhoneForDisplay(auth.user.phone)}
                  </p>
                </div>
                <div className="mobile-theme-block">
                  <div className="theme-section-header">
                    <p className="account-dropdown-label">Workspace theme</p>
                    <Palette size={14} strokeWidth={2} />
                  </div>
                  <div className="theme-switcher" role="radiogroup" aria-label="Theme selector">
                    {theme.options.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={`theme-chip ${theme.theme === option.id ? 'is-active' : ''}`}
                        onClick={() => theme.setTheme(option.id)}
                        role="radio"
                        aria-checked={theme.theme === option.id}
                        aria-label={option.label}
                        title={option.label}
                      >
                        <span className="theme-chip-swatches" aria-hidden="true">
                          {option.swatches.map((color) => (
                            <span
                              key={`${option.id}-${color}`}
                              className="theme-chip-dot"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void auth.logout()}
                  className="account-dropdown-action"
                >
                  <LogOut size={15} strokeWidth={2.1} />
                  Log out
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {notificationsOpen ? (
          <div
            className="mobile-nav-backdrop notification-backdrop"
            onClick={() => setNotificationsOpen(false)}
            aria-hidden="true"
          >
            <div
              className="notification-sheet"
              role="dialog"
              aria-modal="true"
              aria-label="Notifications"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mobile-nav-handle" aria-hidden="true" />
              <div className="notification-dropdown-header">
                <div>
                  <p className="account-dropdown-label">Notifications</p>
                  <p className="notification-dropdown-copy">
                    {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                  </p>
                </div>
                <button
                  type="button"
                  className="mobile-nav-close"
                  onClick={() => setNotificationsOpen(false)}
                  aria-label="Close notifications"
                >
                  <X size={18} strokeWidth={2.2} />
                </button>
              </div>

              {notifications.length > 0 ? (
                <div className="notification-list mobile">
                  {notifications.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`notification-item ${item.readAt ? '' : 'is-unread'}`}
                      onClick={() => void handleNotificationOpen(item)}
                    >
                      <div className="notification-item-head">
                        <span className="notification-item-type">
                          {notificationToneLabel(item.type)}
                        </span>
                        {!item.readAt ? (
                          <span className="notification-item-state">New</span>
                        ) : null}
                      </div>
                      <p className="notification-item-title">{item.title}</p>
                      <p className="notification-item-message">{item.message}</p>
                      <p className="notification-item-time">
                        {formatDateTime(item.createdAt)}
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="notification-empty">
                  <p className="empty-state-title">No notifications yet</p>
                  <p className="empty-state-copy">
                    New handovers, failed deliveries, and invoice events will
                    appear here.
                  </p>
                </div>
              )}

              <div className="notification-sheet-actions">
                <button
                  type="button"
                  className="account-dropdown-action"
                  onClick={() => void handleMarkAllNotificationsRead()}
                  disabled={notificationsLoading || unreadCount === 0}
                >
                  Mark all read
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <main>
          <div className="page-content">
            <div className={`page-shell-hero ${headerVariant === 'compact' ? 'compact' : ''}`}>
              <div>
                <span className="kicker text-[var(--secondary)]">{auth.user.role}</span>
                <h2 className="page-title">{title}</h2>
                {subtitle ? <p className="page-copy">{subtitle}</p> : null}
              </div>
            </div>

            <div className="page-stack">{children}</div>
          </div>
        </main>
      </div>
    </div>
  )
}
