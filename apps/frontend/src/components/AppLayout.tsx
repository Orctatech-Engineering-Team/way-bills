import { Link, Navigate, useRouterState } from '@tanstack/react-router'
import { ChevronDown, LogOut, Menu, Package2, Palette, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import type { UserRole } from '../lib/types'
import { defaultRouteForRole } from '../lib/utils'
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
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const theme = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false)
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

              <div className="account-menu desktop-account-menu" ref={menuRef}>
                <button
                  type="button"
                  className="account-trigger"
                  onClick={() => setMenuOpen((current) => !current)}
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
                      <p className="identity-copy">{auth.user.phone}</p>
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
                  <p className="identity-copy">{auth.user.phone}</p>
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
