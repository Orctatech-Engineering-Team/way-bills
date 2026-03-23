import { Navigate, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useToast } from '../feedback/ToastProvider'
import {
  formatGhanaPhoneForInput,
  normalizeGhanaPhone,
  sanitizeGhanaPhoneInput,
} from '../lib/contact'
import { errorMessageFrom } from '../lib/feedback'
import { defaultRouteForRole } from '../lib/utils'

export function LoginPage() {
  const auth = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (auth.user) {
    return <Navigate to={defaultRouteForRole(auth.user.role)} />
  }

  return (
    <div className="login-shell simple">
      <section className="login-simple-panel">
        <div className="login-simple-copy">
          <p className="kicker text-[var(--secondary)]">Waybill System</p>
          <h1 className="login-simple-title">Sign in to continue</h1>
          <p className="login-simple-text">
            Access dispatch operations, delivery confirmation, reporting, and client billing
            from one workspace.
          </p>
        </div>

        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault()
            setSubmitting(true)

            try {
              const user = await auth.login({
                phone: normalizeGhanaPhone(phone) ?? phone,
                password,
              })
              showToast({
                tone: 'success',
                title: 'Signed in',
                message: `Welcome back, ${user.name}.`,
              })
              await navigate({ to: defaultRouteForRole(user.role) })
            } catch (caughtError) {
              showToast({
                tone: 'error',
                title: 'Sign-in failed',
                message: errorMessageFrom(caughtError, 'Unable to sign in right now.'),
              })
            } finally {
              setSubmitting(false)
            }
          }}
        >
          <label className="field-stack">
            <span className="app-label">Phone</span>
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(sanitizeGhanaPhoneInput(event.target.value))}
              onBlur={() => setPhone((current) => formatGhanaPhoneForInput(current))}
              className="app-input"
              placeholder="024 123 4567 or +233 24 123 4567"
              inputMode="tel"
              autoComplete="tel"
              required
            />
            <p className="field-hint">Saved and matched in the +233 format.</p>
          </label>

          <label className="field-stack">
            <span className="app-label">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="app-input"
              placeholder="Enter your password"
              required
            />
          </label>

          <button
            type="submit"
            disabled={submitting || auth.loading}
            className="btn-primary w-full"
          >
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="login-simple-footer">
          <p className="app-label">Development access</p>
          <p className="text-sm text-[var(--surface-muted)]">
            Seeded accounts remain available in local development.
          </p>
        </div>
      </section>
    </div>
  )
}
