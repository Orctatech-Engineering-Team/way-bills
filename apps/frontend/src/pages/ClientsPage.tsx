import { useEffect, useState, type ReactNode } from 'react'
import { ProtectedScreen } from '../components/AppLayout'
import { useToast } from '../feedback/ToastProvider'
import { api } from '../lib/api'
import {
  formatGhanaPhoneForInput,
  formatGhanaPhoneForDisplay,
  normalizeAddressInput,
  normalizeGhanaPhone,
  sanitizeGhanaPhoneInput,
} from '../lib/contact'
import { errorMessageFrom } from '../lib/feedback'
import type { Client } from '../lib/types'
import {
  centsFromMajorInput,
  formatMoney,
  majorInputFromCents,
  sanitizeMoneyInput,
} from '../lib/utils'

function Panel({
  title,
  copy,
  children,
}: {
  title: string
  copy?: string
  children: ReactNode
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h3 className="panel-title">{title}</h3>
          {copy ? <p className="panel-copy">{copy}</p> : null}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

type ClientFormState = {
  id: string | null
  name: string
  contactName: string
  contactPhone: string
  contactEmail: string
  billingAddress: string
  currency: string
  paymentTermsDays: string
  standardDeliveryRateCents: string
  weeklyBandLimit: string
  overflowDeliveryRateCents: string
  active: boolean
}

function emptyForm(): ClientFormState {
  return {
    id: null,
    name: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    billingAddress: '',
    currency: 'GHS',
    paymentTermsDays: '7',
    standardDeliveryRateCents: '0.00',
    weeklyBandLimit: '',
    overflowDeliveryRateCents: '',
    active: true,
  }
}

function toFormState(client: Client): ClientFormState {
  return {
    id: client.id,
    name: client.name,
    contactName: client.contactName ?? '',
    contactPhone: client.contactPhone ?? '',
    contactEmail: client.contactEmail ?? '',
    billingAddress: client.billingAddress,
    currency: client.currency,
    paymentTermsDays: String(client.paymentTermsDays),
    standardDeliveryRateCents: majorInputFromCents(client.standardDeliveryRateCents),
    weeklyBandLimit: client.weeklyBandLimit !== null ? String(client.weeklyBandLimit) : '',
    overflowDeliveryRateCents:
      client.overflowDeliveryRateCents !== null
        ? majorInputFromCents(client.overflowDeliveryRateCents)
        : '',
    active: client.active,
  }
}

export function ClientsPage() {
  const { showToast } = useToast()
  const [items, setItems] = useState<Client[]>([])
  const [form, setForm] = useState<ClientFormState>(emptyForm())
  const [showInactive, setShowInactive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    setLoading(true)

    try {
      const response = await api.listClients(showInactive ? undefined : { active: true })
      setItems(response.items)
    } catch (caughtError) {
      showToast({
        tone: 'error',
        title: 'Clients failed to load',
        message: errorMessageFrom(caughtError, 'Unable to load client accounts.'),
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [showInactive])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)

    const payload = {
      name: form.name,
      contactName: form.contactName || null,
      contactPhone: form.contactPhone
        ? normalizeGhanaPhone(form.contactPhone) ?? form.contactPhone
        : null,
      contactEmail: form.contactEmail || null,
      billingAddress: normalizeAddressInput(form.billingAddress),
      currency: form.currency.toUpperCase(),
      paymentTermsDays: Number(form.paymentTermsDays || 0),
      standardDeliveryRateCents: centsFromMajorInput(form.standardDeliveryRateCents),
      weeklyBandLimit: form.weeklyBandLimit ? Number(form.weeklyBandLimit) : null,
      overflowDeliveryRateCents: form.overflowDeliveryRateCents
        ? centsFromMajorInput(form.overflowDeliveryRateCents)
        : null,
      active: form.active,
    }

    try {
      if (form.id) {
        await api.updateClient(form.id, payload)
        showToast({
          tone: 'success',
          title: 'Client updated',
          message: `${payload.name} was updated successfully.`,
        })
      } else {
        await api.createClient(payload)
        showToast({
          tone: 'success',
          title: 'Client created',
          message: `${payload.name} is ready for delivery billing.`,
        })
      }

      setForm(emptyForm())
      await load()
    } catch (caughtError) {
      const message = errorMessageFrom(
        caughtError,
        form.id ? 'Unable to update client.' : 'Unable to create client.',
      )
      showToast({
        tone: 'error',
        title: form.id ? 'Update failed' : 'Create failed',
        message,
      })
    } finally {
      setSubmitting(false)
    }
  }

  const activeCount = items.filter((item) => item.active).length

  return (
    <ProtectedScreen
      roles={['admin', 'ops']}
      title="Clients"
      subtitle="Manage the businesses you deliver for, along with billing defaults and payment terms."
    >
      <div className="inline-stat-grid">
        <div className="inline-stat">
          <p className="data-label">Visible clients</p>
          <p className="inline-stat-value">{items.length}</p>
        </div>
        <div className="inline-stat">
          <p className="data-label">Active clients</p>
          <p className="inline-stat-value">{activeCount}</p>
        </div>
      </div>

      <div className="sheet-grid aside">
        <Panel
          title={form.id ? 'Edit client' : 'New client'}
          copy="Keep billing defaults here so waybills and invoices inherit consistent commercial data."
        >
          <form className="grid gap-4 lg:grid-cols-2" onSubmit={handleSubmit}>
            <label className="field-stack">
              <span className="app-label">Business name</span>
              <input
                type="text"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="app-input"
                required
              />
            </label>

            <label className="field-stack">
              <span className="app-label">Contact name</span>
              <input
                type="text"
                value={form.contactName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, contactName: event.target.value }))
                }
                className="app-input"
              />
            </label>

            <label className="field-stack">
              <span className="app-label">Contact phone</span>
              <input
                type="tel"
                value={form.contactPhone}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    contactPhone: sanitizeGhanaPhoneInput(event.target.value),
                  }))
                }
                onBlur={() =>
                  setForm((current) => ({
                    ...current,
                    contactPhone:
                      current.contactPhone === ''
                        ? ''
                        : formatGhanaPhoneForInput(current.contactPhone),
                  }))
                }
                placeholder="024 123 4567 or +233 24 123 4567"
                className="app-input"
                inputMode="tel"
                autoComplete="tel"
              />
              <p className="field-hint">Optional. Saved in the +233 format.</p>
            </label>

            <label className="field-stack">
              <span className="app-label">Contact email</span>
              <input
                type="email"
                value={form.contactEmail}
                onChange={(event) =>
                  setForm((current) => ({ ...current, contactEmail: event.target.value }))
                }
                className="app-input"
              />
            </label>

            <label className="field-stack">
              <span className="app-label">Currency</span>
              <input
                type="text"
                value={form.currency}
                onChange={(event) =>
                  setForm((current) => ({ ...current, currency: event.target.value }))
                }
                className="app-input"
                maxLength={3}
                required
              />
            </label>

            <label className="field-stack">
              <span className="app-label">Payment terms (days)</span>
              <input
                type="number"
                min="0"
                max="90"
                value={form.paymentTermsDays}
                onChange={(event) =>
                  setForm((current) => ({ ...current, paymentTermsDays: event.target.value }))
                }
                className="app-input"
                required
              />
            </label>

            <label className="field-stack">
              <span className="app-label">Standard delivery rate</span>
              <div className="input-with-affix">
                <span className="input-affix">{form.currency || 'GHS'}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.standardDeliveryRateCents}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      standardDeliveryRateCents: sanitizeMoneyInput(event.target.value),
                    }))
                  }
                  className="app-input input-affix-field"
                  placeholder="30.00"
                  required
                />
              </div>
              <p className="field-hint">Enter the flat delivery rate as a normal currency amount.</p>
            </label>

            <label className="field-stack">
              <span className="app-label">Weekly band limit</span>
              <input
                type="number"
                min="0"
                value={form.weeklyBandLimit}
                onChange={(event) =>
                  setForm((current) => ({ ...current, weeklyBandLimit: event.target.value }))
                }
                className="app-input"
                placeholder="Optional weekly delivery count"
              />
            </label>

            <label className="field-stack">
              <span className="app-label">Overflow rate</span>
              <div className="input-with-affix">
                <span className="input-affix">{form.currency || 'GHS'}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.overflowDeliveryRateCents}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      overflowDeliveryRateCents: sanitizeMoneyInput(event.target.value),
                    }))
                  }
                  className="app-input input-affix-field"
                  placeholder="25.00"
                />
              </div>
              <p className="field-hint">
                Optional rate used after the weekly delivery band has been exceeded.
              </p>
            </label>

            <label className="field-stack lg:col-span-2">
              <span className="app-label">Billing address</span>
              <textarea
                value={form.billingAddress}
                onChange={(event) =>
                  setForm((current) => ({ ...current, billingAddress: event.target.value }))
                }
                onBlur={() =>
                  setForm((current) => ({
                    ...current,
                    billingAddress: normalizeAddressInput(current.billingAddress),
                  }))
                }
                className="app-textarea min-h-28"
                autoComplete="street-address"
                placeholder="Spintex Road, Community 18, Accra"
                required
              />
              <p className="field-hint">Use area, landmark, and city in a clean printable line.</p>
            </label>

            <label className="field-checkbox lg:col-span-2">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) =>
                  setForm((current) => ({ ...current, active: event.target.checked }))
                }
              />
              <span>Client is active and can be used on new waybills.</span>
            </label>

            <div className="lg:col-span-2 flex flex-wrap justify-end gap-3">
              {form.id ? (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setForm(emptyForm())}
                >
                  Cancel edit
                </button>
              ) : null}
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? 'Saving...' : form.id ? 'Save client' : 'Create client'}
              </button>
            </div>
          </form>
        </Panel>

        <div className="sheet-stack">
          <div className="sheet-note">
            <p className="app-label">Commercial defaults</p>
            <p className="sheet-note-copy">
              Billing is delivery-based: a standard rate per delivery, an optional weekly
              delivery band, and an overflow rate once that weekly band is exceeded.
            </p>
          </div>
        </div>
      </div>

      <Panel
        title="Client roster"
        copy="Review commercial accounts and jump into edits when a client’s billing details change."
      >
        <div className="mb-5 flex justify-end">
          <label className="field-checkbox">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(event) => setShowInactive(event.target.checked)}
            />
            <span>Include inactive clients</span>
          </label>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--surface-muted)]">Loading clients...</p>
        ) : (
          <>
            <div className="table-shell desktop-only">
              <table className="editorial-table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Contact</th>
                    <th>Pricing</th>
                    <th>Terms</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <button
                          type="button"
                          className="table-action-link"
                          onClick={() => setForm(toFormState(item))}
                        >
                          {item.name}
                        </button>
                        <p className="mt-1 text-[var(--surface-muted)]">{item.billingAddress}</p>
                      </td>
                      <td className="text-[var(--surface-muted)]">
                        <p>{item.contactName ?? 'No contact set'}</p>
                        <p>
                          {item.contactPhone
                            ? formatGhanaPhoneForDisplay(item.contactPhone)
                            : item.contactEmail ?? 'No phone or email'}
                        </p>
                      </td>
                      <td className="text-[var(--surface-muted)]">
                        <p>{formatMoney(item.standardDeliveryRateCents, item.currency)} standard</p>
                        <p>
                          {item.weeklyBandLimit
                            ? `${item.weeklyBandLimit} / week, then ${formatMoney(
                                item.overflowDeliveryRateCents ?? item.standardDeliveryRateCents,
                                item.currency,
                              )}`
                            : 'No weekly overflow band'}
                        </p>
                      </td>
                      <td className="text-[var(--surface-muted)]">{item.paymentTermsDays} days</td>
                      <td>
                        <span className={`status-pill ${item.active ? 'success' : 'neutral'}`}>
                          {item.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mobile-record-list mobile-only">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="mobile-record-card text-left"
                  onClick={() => setForm(toFormState(item))}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-['Manrope'] text-sm font-extrabold text-[var(--primary)]">
                        {item.name}
                      </p>
                      <p className="mt-1 text-sm text-[var(--surface-muted)]">
                        {item.contactName ?? 'No contact set'}
                      </p>
                    </div>
                    <span className={`status-pill ${item.active ? 'success' : 'neutral'}`}>
                      {item.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="mobile-record-row">
                    <div className="data-card">
                      <p className="data-label">Standard rate</p>
                      <p className="data-value">
                        {formatMoney(item.standardDeliveryRateCents, item.currency)}
                      </p>
                    </div>
                    <div className="data-card">
                      <p className="data-label">Weekly band</p>
                      <p className="data-value">
                        {item.weeklyBandLimit
                          ? `${item.weeklyBandLimit}, then ${formatMoney(
                              item.overflowDeliveryRateCents ?? item.standardDeliveryRateCents,
                              item.currency,
                            )}`
                          : 'No overflow band'}
                      </p>
                    </div>
                    <div className="data-card">
                      <p className="data-label">Contact</p>
                      <p className="data-value">
                        {item.contactPhone
                          ? formatGhanaPhoneForDisplay(item.contactPhone)
                          : item.contactEmail ?? 'Not set'}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </Panel>
    </ProtectedScreen>
  )
}
