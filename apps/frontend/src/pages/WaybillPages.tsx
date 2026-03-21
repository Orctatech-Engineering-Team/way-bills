import { Link, useNavigate } from '@tanstack/react-router'
import { Expand, ShieldCheck, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ProtectedScreen } from '../components/AppLayout'
import { SignaturePad } from '../components/SignaturePad'
import { StatusBadge } from '../components/StatusBadge'
import { useAuth } from '../auth/AuthProvider'
import { useToast } from '../feedback/ToastProvider'
import { api, podPdfUrl, waybillPdfUrl } from '../lib/api'
import { fileToDataUrl } from '../lib/files'
import { errorMessageFrom } from '../lib/feedback'
import type {
  Client,
  ShiftDashboard,
  User,
  WaybillDetail,
  WaybillStatus,
  WaybillSummary,
} from '../lib/types'
import {
  centsFromMajorInput,
  deliveryMethodLabel,
  formatDate,
  formatDateTime,
  formatMoney,
  formatValue,
  sanitizeMoneyInput,
} from '../lib/utils'

function Panel({
  title,
  copy,
  children,
  tone = 'default',
  actions,
}: {
  title: string
  copy?: string
  children: React.ReactNode
  tone?: 'default' | 'soft'
  actions?: React.ReactNode
}) {
  return (
    <section className={`panel ${tone === 'soft' ? 'soft' : ''}`}>
      <div className="panel-header">
        <div>
          <h3 className="panel-title">{title}</h3>
          {copy ? <p className="panel-copy">{copy}</p> : null}
        </div>
        {actions ? <div className="panel-header-actions">{actions}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Message({ tone, children }: { tone: 'error' | 'info'; children: React.ReactNode }) {
  return <div className={`alert ${tone}`}>{children}</div>
}

function EvidencePreview({
  src,
  alt,
  emptyCopy,
  imageClassName = 'evidence-image',
}: {
  src?: string | null
  alt: string
  emptyCopy: string
  imageClassName?: string
}) {
  if (!src) {
    return <div className="empty-evidence">{emptyCopy}</div>
  }

  return (
    <div className="evidence-frame">
      <img src={src} alt={alt} className={imageClassName} />
    </div>
  )
}

function loadingTable(label: string) {
  return <div className="loading-panel">{label}</div>
}

function recipientLabel(name: string | null | undefined) {
  return formatValue(name, 'No recipient name')
}

function waybillStatusTotals(items: WaybillSummary[]) {
  return {
    total: items.length,
    active: items.filter((item) =>
      item.status === 'created' || item.status === 'assigned' || item.status === 'dispatched').length,
    delivered: items.filter((item) => item.status === 'delivered').length,
    exceptions: items.filter((item) => item.status === 'failed' || item.status === 'cancelled').length,
  }
}

export function OpsWaybillListPage() {
  const { showToast } = useToast()
  const [items, setItems] = useState<WaybillSummary[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [clientId, setClientId] = useState('')

  async function load() {
    setLoading(true)
    setError('')

    try {
      const [waybillResponse, clientResponse] = await Promise.all([
        api.listWaybills({
          search: search || undefined,
          status: status || undefined,
        }),
        api.listClients({ active: true }),
      ])

      setItems(
        clientId
          ? waybillResponse.items.filter((item) => item.clientId === clientId)
          : waybillResponse.items,
      )
      setClients(clientResponse.items)
    } catch (caughtError) {
      const message = errorMessageFrom(caughtError, 'Unable to load waybills.')
      setError(message)
      showToast({
        tone: 'error',
        title: 'Waybills failed to load',
        message,
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [clientId, search, status])

  const totals = waybillStatusTotals(items)

  return (
    <ProtectedScreen
      roles={['admin', 'ops']}
      title="Waybills"
      subtitle="Search and filter all delivery records, review rider activity, and monitor completion from one list."
    >
      {!loading ? (
        <div className="inline-stat-grid">
          {[
            ['Total records', totals.total],
            ['Live workflow', totals.active],
            ['Delivered', totals.delivered],
            ['Exceptions', totals.exceptions],
          ].map(([label, value]) => (
            <div key={label} className="inline-stat">
              <p className="data-label">{label}</p>
              <p className="inline-stat-value">{value}</p>
            </div>
          ))}
        </div>
      ) : null}

      <Panel title="Delivery records">
        <div className="mb-5 flex flex-wrap gap-3">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by waybill, order ref, recipient, phone"
            className="app-input w-full flex-1 md:min-w-[18rem]"
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="app-select w-full md:min-w-[12rem]"
          >
            <option value="">All statuses</option>
            <option value="created">Created</option>
            <option value="assigned">Assigned</option>
            <option value="dispatched">Dispatched</option>
            <option value="delivered">Delivered</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            className="app-select w-full md:min-w-[12rem]"
          >
            <option value="">All clients</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>

        {error ? <Message tone="error">{error}</Message> : null}
        {loading ? (
          loadingTable('Loading waybills...')
        ) : (
          <>
            <div className="table-shell desktop-only">
              <table className="editorial-table">
                <thead>
                  <tr>
                    <th>Waybill</th>
                    <th>Client</th>
                    <th>Recipient</th>
                    <th>Location</th>
                    <th>Rider</th>
                    <th>Status</th>
                    <th>Dispatch</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <Link
                          to="/ops/waybills/$waybillId"
                          params={{ waybillId: item.id }}
                          className="font-['Manrope'] text-sm font-extrabold text-[var(--primary)] no-underline"
                        >
                          {item.waybillNumber}
                        </Link>
                        <p className="mt-1 text-[var(--surface-muted)]">{item.orderReference}</p>
                      </td>
                      <td className="text-[var(--surface-muted)]">
                        {item.clientName ?? 'Not assigned'}
                      </td>
                      <td className="text-[var(--surface-muted)]">
                        <p className="font-medium text-[var(--surface-ink)]">
                          {recipientLabel(item.customerName)}
                        </p>
                        <p>{item.customerPhone}</p>
                      </td>
                      <td className="text-[var(--surface-muted)]">
                        {item.deliveryAddress}
                      </td>
                      <td className="text-[var(--surface-muted)]">
                        {item.riderName ?? 'Unassigned'}
                      </td>
                      <td>
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="text-[var(--surface-muted)]">
                        {formatDateTime(item.dispatchTime)}
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-10 text-center text-sm text-[var(--surface-muted)]"
                      >
                        No waybills match the current filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="mobile-record-list mobile-only">
              {items.map((item) => (
                <Link
                  key={item.id}
                  to="/ops/waybills/$waybillId"
                  params={{ waybillId: item.id }}
                  className="mobile-record-card no-underline"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-['Manrope'] text-sm font-extrabold text-[var(--primary)]">
                        {item.waybillNumber}
                      </p>
                      <p className="mt-1 text-sm text-[var(--surface-muted)]">{item.orderReference}</p>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                  <div className="mobile-record-row">
                    <div className="data-card">
                      <p className="data-label">Client</p>
                      <p className="data-value">{item.clientName ?? 'Not assigned'}</p>
                    </div>
                    <div className="data-card">
                      <p className="data-label">Recipient</p>
                      <p className="data-value">{recipientLabel(item.customerName)}</p>
                    </div>
                    <div className="data-card">
                      <p className="data-label">Location</p>
                      <p className="data-value">{item.deliveryAddress}</p>
                    </div>
                    <div className="data-card">
                      <p className="data-label">Phone</p>
                      <p className="data-value">{item.customerPhone}</p>
                    </div>
                    <div className="data-card">
                      <p className="data-label">Rider</p>
                      <p className="data-value">{item.riderName ?? 'Unassigned'}</p>
                    </div>
                    <div className="data-card">
                      <p className="data-label">Dispatch</p>
                      <p className="data-value">{formatDateTime(item.dispatchTime)}</p>
                    </div>
                  </div>
                </Link>
              ))}
              {items.length === 0 ? (
                <Message tone="info">No waybills match the current filters.</Message>
              ) : null}
            </div>
          </>
        )}
      </Panel>
    </ProtectedScreen>
  )
}

export function CreateWaybillPage() {
  const auth = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [clients, setClients] = useState<Client[]>([])
  const [error, setError] = useState('')
  const [loadingClients, setLoadingClients] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitIntent, setSubmitIntent] = useState<'open' | 'add-another'>('open')
  const [form, setForm] = useState({
    orderReference: '',
    clientId: auth.user?.defaultClientId ?? '',
    customerName: '',
    customerPhone: '',
    deliveryAddress: '',
    deliveryMethod: 'cash' as 'cash' | 'momo' | 'card' | 'bank_transfer' | 'other',
    itemValueCents: '',
    notes: '',
    receiptImageDataUrl: '',
    receiptImagePreviewUrl: '',
  })

  useEffect(() => {
    let cancelled = false

    async function loadClients() {
      try {
        const response = await api.listClients({ active: true })
        if (!cancelled) {
          setClients(response.items)
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(errorMessageFrom(caughtError, 'Unable to load client accounts.'))
        }
      } finally {
        if (!cancelled) {
          setLoadingClients(false)
        }
      }
    }

    void loadClients()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (auth.user?.defaultClientId && !form.clientId) {
      setForm((current) => ({
        ...current,
        clientId: auth.user?.defaultClientId ?? '',
      }))
    }
  }, [auth.user?.defaultClientId, form.clientId])

  const selectedClient = clients.find((client) => client.id === form.clientId)
  const itemValueCurrency = selectedClient?.currency ?? 'GHS'

  return (
    <ProtectedScreen
      roles={['rider']}
      title="New Delivery"
      subtitle="Create and queue multiple waybills first, then dispatch them together when you are ready to leave."
    >
      <div className="sheet-grid aside">
        <Panel title="Delivery details">
          <form
            className="grid gap-4 lg:grid-cols-2"
            onSubmit={async (event) => {
              event.preventDefault()
              setError('')
              setSubmitting(true)

              try {
                const response = await api.createWaybill({
                  orderReference: form.orderReference,
                  clientId: form.clientId,
                  customerName: form.customerName || null,
                  customerPhone: form.customerPhone,
                  deliveryAddress: form.deliveryAddress,
                  deliveryMethod: form.deliveryMethod,
                  itemValueCents: form.itemValueCents
                    ? centsFromMajorInput(form.itemValueCents)
                    : null,
                  receiptImageDataUrl: form.receiptImageDataUrl || undefined,
                  notes: form.notes || null,
                })

                showToast({
                  tone: 'success',
                  title: 'Waybill created',
                  message: `${response.waybill.waybillNumber} was added to your dispatch queue.`,
                })
                if (submitIntent === 'add-another') {
                  setForm((current) => ({
                    ...current,
                    orderReference: '',
                    customerName: '',
                    customerPhone: '',
                    deliveryAddress: '',
                    itemValueCents: '',
                    notes: '',
                    receiptImageDataUrl: '',
                    receiptImagePreviewUrl: '',
                  }))
                } else {
                  await navigate({
                    to: auth.user?.role === 'rider' ? '/rider/jobs/$waybillId' : '/ops/waybills/$waybillId',
                    params: { waybillId: response.waybill.id },
                  })
                }
              } catch (caughtError) {
                const message = errorMessageFrom(
                  caughtError,
                  'Unable to create the waybill.',
                )
                setError(message)
                showToast({
                  tone: 'error',
                  title: 'Waybill creation failed',
                  message,
                })
              } finally {
                setSubmitting(false)
              }
            }}
          >
            <label className="field-stack">
              <span className="app-label">Order reference</span>
              <input
                type="text"
                value={form.orderReference}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    orderReference: event.target.value,
                  }))
                }
                className="app-input"
                required
              />
            </label>

            <label className="field-stack">
              <span className="app-label">Recipient phone</span>
              <input
                type="text"
                value={form.customerPhone}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    customerPhone: event.target.value,
                  }))
                }
                className="app-input"
                required
              />
            </label>

            <label className="field-stack">
              <span className="app-label">Recipient name</span>
              <input
                type="text"
                value={form.customerName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    customerName: event.target.value,
                  }))
                }
                className="app-input"
                placeholder="Optional"
              />
            </label>

            <label className="field-stack">
              <span className="app-label">Delivery method</span>
              <select
                value={form.deliveryMethod}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    deliveryMethod: event.target.value as typeof form.deliveryMethod,
                  }))
                }
                className="app-select"
              >
                <option value="cash">Cash</option>
                <option value="momo">MoMo</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label className="field-stack">
              <span className="app-label">Client</span>
              <select
                value={form.clientId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    clientId: event.target.value,
                  }))
                }
                className="app-select"
                disabled={loadingClients}
                required
              >
                <option value="">Select client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-stack">
              <span className="app-label">Item value</span>
              <div className="input-with-affix">
                <span className="input-affix">{itemValueCurrency}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.itemValueCents}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      itemValueCents: sanitizeMoneyInput(event.target.value),
                    }))
                  }
                  className="app-input input-affix-field"
                  placeholder="1200.00"
                />
              </div>
              <p className="field-hint">
                This is shown on the waybill for reference only. Client billing still uses the
                delivery pricing rule.
              </p>
            </label>

            <label className="field-stack lg:col-span-2">
              <span className="app-label">Location</span>
              <textarea
                value={form.deliveryAddress}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    deliveryAddress: event.target.value,
                  }))
                }
                className="app-textarea min-h-28"
                required
              />
            </label>

            <label className="field-stack lg:col-span-2">
              <span className="app-label">Notes</span>
              <textarea
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                className="app-textarea min-h-24"
              />
            </label>

            <div className="field-stack lg:col-span-2">
              <span className="app-label">Business receipt image</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                capture="environment"
                className="app-input app-file-input"
                onChange={async (event) => {
                  const file = event.target.files?.[0]
                  if (!file) {
                    return
                  }

                  try {
                    const dataUrl = await fileToDataUrl(file)
                    setForm((current) => ({
                      ...current,
                      receiptImageDataUrl: dataUrl,
                      receiptImagePreviewUrl: dataUrl,
                    }))
                  } catch (caughtError) {
                    const message = errorMessageFrom(
                      caughtError,
                      'Unable to read the receipt image.',
                    )
                    setError(message)
                    showToast({
                      tone: 'error',
                      title: 'Receipt upload failed',
                      message,
                    })
                  } finally {
                    event.target.value = ''
                  }
                }}
              />
              <p className="field-hint">
                Upload or capture the merchant receipt so the rider and operations team can
                verify the order before delivery.
              </p>
              <EvidencePreview
                src={form.receiptImagePreviewUrl}
                alt="Business receipt preview"
                emptyCopy="No receipt image has been attached yet."
              />
              {form.receiptImagePreviewUrl ? (
                <div className="action-cluster">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        receiptImageDataUrl: '',
                        receiptImagePreviewUrl: '',
                      }))
                    }
                  >
                    Remove image
                  </button>
                </div>
              ) : null}
            </div>

            {error ? <Message tone="error">{error}</Message> : null}

            <div className="lg:col-span-2 flex justify-end">
              <div className="action-cluster">
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-secondary"
                  onClick={() => setSubmitIntent('add-another')}
                >
                  {submitting && submitIntent === 'add-another' ? 'Saving...' : 'Create and add another'}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary"
                  onClick={() => setSubmitIntent('open')}
                >
                  {submitting && submitIntent === 'open' ? 'Creating...' : 'Create waybill'}
                </button>
              </div>
            </div>
          </form>
        </Panel>

        <div className="sheet-stack">
          <div className="sheet-note">
            <p className="app-label">Required record</p>
            <p className="inline-stat-value !mt-3 !text-[1.45rem]">Fast field dispatch</p>
            <p className="sheet-note-copy">
              Capture only what the rider needs in the field. Recipient phone is required,
              recipient name is optional, and client attachment is required for billing.
            </p>
          </div>
          <div className="sheet-note">
            <p className="app-label">Workflow</p>
            <div className="mt-3 space-y-3 text-sm text-[var(--surface-muted)]">
              <p><strong className="text-[var(--primary)]">1.</strong> Rider creates each waybill separately and queues it.</p>
              <p><strong className="text-[var(--primary)]">2.</strong> Dispatch selected waybills together when leaving for the route.</p>
              <p><strong className="text-[var(--primary)]">3.</strong> Receiver signs to capture delivery time and lock the completed record.</p>
            </div>
          </div>
        </div>
      </div>
    </ProtectedScreen>
  )
}

function detailBands(waybill: WaybillDetail) {
  return [
    {
      title: 'Location',
      value: waybill.deliveryAddress,
      tone: 'low' as const,
      span: 'md:col-span-2',
      detail: `${recipientLabel(waybill.customerName)} • ${waybill.customerPhone}`,
    },
    {
      title: 'Dispatch time',
      value: formatDateTime(waybill.dispatchTime),
      tone: 'high' as const,
      span: '',
      detail: waybill.assignedRider?.name ?? 'No rider recorded',
    },
    {
      title: 'Delivery time',
      value: formatDateTime(waybill.completionTime),
      tone: 'low' as const,
      span: '',
      detail: waybill.pod?.recipientName ?? 'Pending receiver signature',
    },
    {
      title: 'Return time',
      value: formatDateTime(waybill.returnTime),
      tone: 'low' as const,
      span: '',
      detail:
        waybill.status === 'failed' || waybill.status === 'cancelled'
          ? 'Closed without delivery'
          : 'Only recorded for returned or cancelled jobs',
    },
    {
      title: 'Delivery method',
      value: deliveryMethodLabel(waybill.deliveryMethod),
      tone: 'low' as const,
      span: '',
      detail: waybill.client?.name ?? 'No client attached',
    },
  ]
}

function RiderProfileCard({ rider }: { rider: WaybillDetail['assignedRider'] }) {
  if (!rider) {
    return (
      <p className="text-sm text-[var(--surface-muted)]">
        No rider is assigned to this waybill yet.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="entity-header">
        {rider.profileImageUrl ? (
          <img
            src={rider.profileImageUrl}
            alt={`${rider.name} profile`}
            className="profile-avatar"
          />
        ) : (
          <span className="profile-avatar-placeholder">
            {rider.name
              .split(' ')
              .map((part) => part[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()}
          </span>
        )}
        <div className="entity-copy">
          <div className="entity-title-row">
            <p className="entity-title">{rider.name}</p>
            <span className="entity-pill">Assigned rider</span>
          </div>
          <p className="entity-meta">{rider.phone}</p>
          {rider.vehicleType ? (
            <p className="entity-subcopy">{rider.vehicleType}</p>
          ) : null}
        </div>
      </div>

      <div className="compact-fact-grid profile-fact-grid">
        <div className="compact-fact">
          <p className="data-label">Vehicle</p>
          <p className="data-value">{rider.vehicleType ?? 'Not recorded'}</p>
        </div>
        <div className="compact-fact">
          <p className="data-label">Plate number</p>
          <p className="data-value">{rider.vehiclePlateNumber ?? 'Not recorded'}</p>
        </div>
        <div className="compact-fact">
          <p className="data-label">License number</p>
          <p className="data-value">{rider.licenseNumber ?? 'Not recorded'}</p>
        </div>
        <div className="compact-fact">
          <p className="data-label">Base address</p>
          <p className="data-value">{rider.address ?? 'Not recorded'}</p>
        </div>
      </div>

      {rider.notes ? (
        <div className="compact-fact">
          <p className="data-label">Rider notes</p>
          <p className="data-value">{rider.notes}</p>
        </div>
      ) : null}
    </div>
  )
}

function CustomerBrief({ waybill }: { waybill: WaybillDetail }) {
  return (
    <div className="compact-fact-grid">
      <div className="compact-fact">
        <p className="data-label">Client</p>
        <p className="data-value">{waybill.client?.name ?? 'Not attached'}</p>
      </div>
      <div className="compact-fact">
        <p className="data-label">Recipient</p>
        <p className="data-value">{recipientLabel(waybill.customerName)}</p>
      </div>
      <div className="compact-fact">
        <p className="data-label">Recipient phone</p>
        <p className="data-value">{waybill.customerPhone}</p>
      </div>
      <div className="compact-fact">
        <p className="data-label">Delivery method</p>
        <p className="data-value">{deliveryMethodLabel(waybill.deliveryMethod)}</p>
      </div>
      <div className="compact-fact lg:col-span-2">
        <p className="data-label">Location</p>
        <p className="data-value">{waybill.deliveryAddress}</p>
      </div>
      <div className="compact-fact">
        <p className="data-label">Item value</p>
        <p className="data-value">
          {waybill.itemValueCents !== null
            ? formatMoney(waybill.itemValueCents, waybill.client?.currency ?? 'GHS')
            : 'Not recorded'}
        </p>
      </div>
      <div className="compact-fact">
        <p className="data-label">Dispatch time</p>
        <p className="data-value">{formatDateTime(waybill.dispatchTime)}</p>
      </div>
      <div className="compact-fact">
        <p className="data-label">Delivery time</p>
        <p className="data-value">{formatDateTime(waybill.completionTime)}</p>
      </div>
      <div className="compact-fact">
        <p className="data-label">Return time</p>
        <p className="data-value">{formatDateTime(waybill.returnTime)}</p>
      </div>
      {waybill.notes ? (
        <div className="compact-fact lg:col-span-2">
          <p className="data-label">Delivery notes</p>
          <p className="data-value">{waybill.notes}</p>
        </div>
      ) : null}
    </div>
  )
}

function PodSigningForm({
  waybill,
  recipientName,
  setRecipientName,
  podNote,
  setPodNote,
  signatureDataUrl,
  setSignatureDataUrl,
  onSubmit,
  immersive = false,
}: {
  waybill: WaybillDetail
  recipientName: string
  setRecipientName: (value: string) => void
  podNote: string
  setPodNote: (value: string) => void
  signatureDataUrl: string
  setSignatureDataUrl: (value: string) => void
  onSubmit: () => Promise<void>
  immersive?: boolean
}) {
  return (
    <div className={`pod-flow ${immersive ? 'immersive' : ''}`}>
      <div className={`pod-summary-card ${immersive ? 'immersive' : ''}`}>
        <div className="pod-summary-badge">
          <ShieldCheck size={16} strokeWidth={2.2} />
          Recipient review
        </div>
        <h4 className="pod-summary-title">Confirm this delivery before signing.</h4>
        <div className="pod-summary-grid">
          <div className="compact-fact">
            <p className="data-label">Waybill</p>
            <p className="data-value">{waybill.waybillNumber}</p>
          </div>
          <div className="compact-fact">
            <p className="data-label">Order reference</p>
            <p className="data-value">{waybill.orderReference}</p>
          </div>
          <div className="compact-fact">
            <p className="data-label">Recipient</p>
            <p className="data-value">{recipientLabel(waybill.customerName)}</p>
          </div>
          <div className="compact-fact">
            <p className="data-label">Recipient phone</p>
            <p className="data-value">{waybill.customerPhone}</p>
          </div>
          <div className="compact-fact">
            <p className="data-label">Delivery method</p>
            <p className="data-value">{deliveryMethodLabel(waybill.deliveryMethod)}</p>
          </div>
          <div className="compact-fact pod-summary-wide">
            <p className="data-label">Location</p>
            <p className="data-value">{waybill.deliveryAddress}</p>
          </div>
        </div>
        <p className="pod-summary-copy">
          By signing, the recipient confirms that the listed goods were received in good
          condition at the stated location.
        </p>
      </div>

      <div className="pod-field-grid">
        <label className="field-stack">
          <span className="app-label">Recipient full name</span>
          <input
            type="text"
            value={recipientName}
            onChange={(event) => setRecipientName(event.target.value)}
            className="app-input"
            placeholder="Optional"
          />
        </label>

        <label className="field-stack">
          <span className="app-label">Review</span>
          <input
            type="text"
            value={podNote}
            onChange={(event) => setPodNote(event.target.value)}
            className="app-input"
            placeholder="Optional comment from the recipient"
          />
        </label>
      </div>

      <SignaturePad value={signatureDataUrl} onChange={setSignatureDataUrl} />

      <div className="pod-submit-row">
        <div className="pod-rule-card">
          <p className="app-label">Completion rule</p>
          <p className="pod-rule-copy">
            Delivery closes once the recipient signs. Their name and review are optional,
            and the signed POD becomes part of the permanent audit trail.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onSubmit()}
          disabled={!signatureDataUrl}
          className="btn-success pod-submit-button"
        >
          Complete delivery
        </button>
      </div>
    </div>
  )
}

function RecipientModeOverlay({
  open,
  onClose,
  waybill,
  children,
}: {
  open: boolean
  onClose: () => void
  waybill: WaybillDetail
  children: React.ReactNode
}) {
  useEffect(() => {
    if (!open) {
      return
    }

    const previousOverflow = document.body.style.overflow

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open, onClose])

  if (!open) {
    return null
  }

  return (
    <div className="recipient-overlay" role="dialog" aria-modal="true" aria-label="Recipient mode">
      <div className="recipient-overlay-shell">
        <div className="recipient-overlay-header">
          <div>
            <p className="recipient-overlay-kicker">Recipient mode</p>
            <h3 className="recipient-overlay-title">Confirm and sign for delivery</h3>
            <p className="recipient-overlay-copy">Waybill {waybill.waybillNumber}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="recipient-overlay-close"
            aria-label="Close recipient mode"
          >
            <X size={18} strokeWidth={2.2} />
          </button>
        </div>

        <div className="recipient-overlay-body">{children}</div>
      </div>
    </div>
  )
}

function RecipientModePrompt({
  open,
  onOpen,
  onDismiss,
}: {
  open: boolean
  onOpen: () => void
  onDismiss: () => void
}) {
  if (!open) {
    return null
  }

  return (
    <div className="recipient-mode-prompt" role="status" aria-live="polite">
      <div className="recipient-mode-prompt-copy">
        <p className="recipient-mode-prompt-kicker">Recommended on mobile</p>
        <p className="recipient-mode-prompt-title">Use recipient mode for handoff</p>
        <p className="recipient-mode-prompt-text">
          It hides the rest of the workspace and keeps only the delivery confirmation and
          signature visible to the customer.
        </p>
      </div>
      <div className="recipient-mode-prompt-actions">
        <button
          type="button"
          onClick={onOpen}
          className="btn-primary"
        >
          Open recipient mode
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="btn-quiet"
        >
          Stay here
        </button>
      </div>
    </div>
  )
}

function PodSigningCard({
  waybill,
  recipientName,
  setRecipientName,
  podNote,
  setPodNote,
  signatureDataUrl,
  setSignatureDataUrl,
  onSubmit,
  onOpenRecipientMode,
}: {
  waybill: WaybillDetail
  recipientName: string
  setRecipientName: (value: string) => void
  podNote: string
  setPodNote: (value: string) => void
  signatureDataUrl: string
  setSignatureDataUrl: (value: string) => void
  onSubmit: () => Promise<void>
  onOpenRecipientMode: () => void
}) {
  return (
    <Panel
      title="Proof of delivery"
      copy="Present this section to the recipient and capture the final handoff clearly."
      actions={
        <button
          type="button"
          onClick={onOpenRecipientMode}
          className="btn-quiet recipient-mode-trigger"
        >
          <Expand size={15} strokeWidth={2.2} />
          Recipient mode
        </button>
      }
    >
      <PodSigningForm
        waybill={waybill}
        recipientName={recipientName}
        setRecipientName={setRecipientName}
        podNote={podNote}
        setPodNote={setPodNote}
        signatureDataUrl={signatureDataUrl}
        setSignatureDataUrl={setSignatureDataUrl}
        onSubmit={onSubmit}
      />
    </Panel>
  )
}

function ReceiptPanel({
  waybill,
  canManage,
  draftUrl,
  previewUrl,
  busy,
  onSelect,
  onSave,
  onClear,
}: {
  waybill: WaybillDetail
  canManage: boolean
  draftUrl: string
  previewUrl: string
  busy: boolean
  onSelect: (file: File) => Promise<void>
  onSave: () => Promise<void>
  onClear: () => void
}) {
  const displayUrl = previewUrl || waybill.receiptImageUrl

  return (
    <Panel
      title="Business receipt"
      copy="Merchant receipt or order slip supplied by the business for this delivery."
    >
      <div className="media-panel-stack">
        <EvidencePreview
          src={displayUrl}
          alt="Business receipt"
          emptyCopy="No receipt image has been attached to this waybill yet."
        />

        {displayUrl ? (
          <a
            href={displayUrl}
            target="_blank"
            rel="noreferrer"
            className="document-link"
          >
            Open receipt image
          </a>
        ) : null}

        {canManage ? (
          <>
            <label className="field-stack">
              <span className="app-label">Capture or upload receipt</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                capture="environment"
                className="app-input app-file-input"
                onChange={async (event) => {
                  const file = event.target.files?.[0]
                  if (!file) {
                    return
                  }

                  await onSelect(file)
                  event.target.value = ''
                }}
              />
            </label>

            <div className="action-cluster">
              <button
                type="button"
                onClick={() => void onSave()}
                disabled={!draftUrl || busy}
                className="btn-primary"
              >
                {busy ? 'Saving...' : displayUrl && draftUrl ? 'Replace receipt' : 'Save receipt'}
              </button>
              <button
                type="button"
                onClick={onClear}
                disabled={busy || (!draftUrl && !waybill.receiptImageUrl)}
                className="btn-secondary"
              >
                {draftUrl ? 'Clear selection' : 'Remove receipt'}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </Panel>
  )
}

function HandoverPanel({
  riders,
  selectedRider,
  setSelectedRider,
  note,
  setNote,
  disabled,
  onSubmit,
}: {
  riders: User[]
  selectedRider: string
  setSelectedRider: (value: string) => void
  note: string
  setNote: (value: string) => void
  disabled: boolean
  onSubmit: () => Promise<void>
}) {
  return (
    <Panel
      title="Rider handover"
      copy="Transfer the live waybill to another rider when the shift changes or a replacement takes over."
      tone="soft"
    >
      <div className="space-y-3">
        <select
          value={selectedRider}
          onChange={(event) => setSelectedRider(event.target.value)}
          className="app-select w-full"
        >
          <option value="">Select replacement rider</option>
          {riders.map((rider) => (
            <option key={rider.id} value={rider.id}>
              {rider.name}
            </option>
          ))}
        </select>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Optional handover note for the next rider"
          className="app-textarea min-h-24"
        />
        <button
          type="button"
          onClick={() => void onSubmit()}
          disabled={disabled}
          className="btn-primary"
        >
          Handover to rider
        </button>
      </div>
    </Panel>
  )
}

function actionStatuses(role: 'admin' | 'ops' | 'rider', status: WaybillStatus) {
  if (status === 'assigned') {
    return [
      { label: 'Dispatch', value: 'dispatched' },
      { label: 'Mark failed', value: 'failed' },
      ...(role !== 'rider' ? [{ label: 'Cancel', value: 'cancelled' }] : []),
    ]
  }

  if (status === 'created' && role !== 'rider') {
    return [{ label: 'Cancel', value: 'cancelled' }]
  }

  if (status === 'dispatched') {
    return [{ label: 'Mark failed', value: 'failed' }]
  }

  return []
}

function WaybillDetailScreen({
  mode,
  waybillId,
}: {
  mode: 'ops' | 'rider'
  waybillId: string
}) {
  const auth = useAuth()
  const { showToast } = useToast()
  const [waybill, setWaybill] = useState<WaybillDetail | null>(null)
  const [riders, setRiders] = useState<User[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [statusNote, setStatusNote] = useState('')
  const [handoverNote, setHandoverNote] = useState('')
  const [selectedRider, setSelectedRider] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [podNote, setPodNote] = useState('')
  const [signatureDataUrl, setSignatureDataUrl] = useState('')
  const [receiptImageDataUrl, setReceiptImageDataUrl] = useState('')
  const [receiptImagePreviewUrl, setReceiptImagePreviewUrl] = useState('')
  const [receiptBusy, setReceiptBusy] = useState(false)
  const [recipientModeOpen, setRecipientModeOpen] = useState(false)
  const [isSmallScreen, setIsSmallScreen] = useState(false)
  const [recipientModePromptDismissed, setRecipientModePromptDismissed] = useState(false)

  async function load() {
    setLoading(true)
    setError('')

    try {
      const [waybillResponse, riderResponse] = await Promise.all([
        api.getWaybill(waybillId),
        api.listUsers({ role: 'rider', active: true }),
      ])

      setWaybill(waybillResponse.waybill)
      setSelectedRider(
        mode === 'ops' && waybillResponse.waybill.status === 'created'
          ? waybillResponse.waybill.assignedRider?.id ?? ''
          : '',
      )
      setRecipientName(waybillResponse.waybill.pod?.recipientName ?? '')
      setRiders(riderResponse.items)
      setReceiptImageDataUrl('')
      setReceiptImagePreviewUrl('')
    } catch (caughtError) {
      setError(errorMessageFrom(caughtError, 'Unable to load the waybill.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [mode, waybillId])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 720px)')
    const sync = () => setIsSmallScreen(media.matches)

    sync()
    media.addEventListener('change', sync)

    return () => {
      media.removeEventListener('change', sync)
    }
  }, [])

  useEffect(() => {
    if (waybill?.status === 'dispatched' && !waybill.pod) {
      setRecipientModePromptDismissed(false)
    }
  }, [waybill?.status, waybill?.pod, waybillId])

  async function updateStatus(status: string) {
    try {
      await api.updateWaybillStatus(waybillId, status, statusNote || undefined)
      showToast({
        tone: status === 'failed' || status === 'cancelled' ? 'warning' : 'success',
        title: 'Waybill updated',
        message: `Delivery status changed to ${status}.`,
      })
      setStatusNote('')
      await load()
    } catch (caughtError) {
      const message = errorMessageFrom(caughtError, 'Unable to update the waybill.')
      setError(message)
      showToast({
        tone: 'error',
        title: 'Waybill update failed',
        message,
      })
    }
  }

  async function selectReceiptFile(file: File) {
    try {
      const dataUrl = await fileToDataUrl(file)
      setReceiptImageDataUrl(dataUrl)
      setReceiptImagePreviewUrl(dataUrl)
      setError('')
    } catch (caughtError) {
      setError(
        errorMessageFrom(caughtError, 'Unable to read the receipt image.'),
      )
      showToast({
        tone: 'error',
        title: 'Receipt read failed',
        message: errorMessageFrom(caughtError, 'Unable to read the receipt image.'),
      })
    }
  }

  async function saveReceipt() {
    if (!receiptImageDataUrl) {
      return
    }

    try {
      setReceiptBusy(true)
      const response = await api.updateWaybillReceipt(waybillId, {
        receiptImageDataUrl,
      })
      setWaybill(response.waybill)
      setReceiptImageDataUrl('')
      setReceiptImagePreviewUrl('')
      setError('')
      showToast({
        tone: 'success',
        title: 'Receipt saved',
        message: 'The merchant receipt has been updated.',
      })
    } catch (caughtError) {
      const message = errorMessageFrom(caughtError, 'Unable to save the receipt image.')
      setError(message)
      showToast({
        tone: 'error',
        title: 'Receipt save failed',
        message,
      })
    } finally {
      setReceiptBusy(false)
    }
  }

  async function clearReceipt() {
    if (receiptImageDataUrl) {
      setReceiptImageDataUrl('')
      setReceiptImagePreviewUrl('')
      return
    }

    if (!waybill?.receiptImageUrl) {
      return
    }

    try {
      setReceiptBusy(true)
      const response = await api.updateWaybillReceipt(waybillId, {
        receiptImageDataUrl: null,
      })
      setWaybill(response.waybill)
      setError('')
      showToast({
        tone: 'warning',
        title: 'Receipt removed',
        message: 'The stored merchant receipt was removed.',
      })
    } catch (caughtError) {
      const message = errorMessageFrom(caughtError, 'Unable to remove the receipt image.')
      setError(message)
      showToast({
        tone: 'error',
        title: 'Receipt removal failed',
        message,
      })
    } finally {
      setReceiptBusy(false)
    }
  }

  async function submitPod() {
    try {
      await api.createPod(waybillId, {
        recipientName: recipientName || null,
        signatureDataUrl,
        note: podNote || null,
      })
      setPodNote('')
      setSignatureDataUrl('')
      setRecipientModeOpen(false)
      showToast({
        tone: 'success',
        title: 'Delivery completed',
        message: 'Proof of delivery was captured successfully.',
      })
      await load()
    } catch (caughtError) {
      const message = errorMessageFrom(caughtError, 'Unable to save proof of delivery.')
      setError(message)
      showToast({
        tone: 'error',
        title: 'POD capture failed',
        message,
      })
    }
  }

  async function handoverWaybill() {
    if (!selectedRider) {
      return
    }

    try {
      const response = await api.handoverWaybill(waybillId, {
        riderId: selectedRider,
        note: handoverNote || null,
      })
      setWaybill(response.waybill)
      setSelectedRider('')
      setHandoverNote('')
      setError('')
      showToast({
        tone: 'success',
        title: 'Waybill handed over',
        message: `The waybill is now assigned to ${response.waybill.assignedRider?.name ?? 'the selected rider'}.`,
      })
    } catch (caughtError) {
      const message = errorMessageFrom(caughtError, 'Unable to hand over the waybill.')
      setError(message)
      showToast({
        tone: 'error',
        title: 'Handover failed',
        message,
      })
    }
  }

  if (loading) {
    return loadingTable('Loading waybill...')
  }

  if (!waybill) {
    return <Message tone="error">{error || 'Waybill not found.'}</Message>
  }

  const currentRole = auth.user?.role ?? 'ops'
  const actions = actionStatuses(currentRole, waybill.status)
  const showRecipientModePrompt =
    isSmallScreen &&
    waybill.status === 'dispatched' &&
    !waybill.pod &&
    !recipientModeOpen &&
    !recipientModePromptDismissed

  return (
    <div className="detail-page-stack">
      {error ? <Message tone="error">{error}</Message> : null}

      <RecipientModePrompt
        open={showRecipientModePrompt}
        onOpen={() => {
          setRecipientModePromptDismissed(true)
          setRecipientModeOpen(true)
        }}
        onDismiss={() => setRecipientModePromptDismissed(true)}
      />

      <section className="detail-primary-stack">
        <div className="detail-document-hero">
          <div className="detail-document-copy">
            <span className="kicker text-[var(--secondary)]">Delivery record</span>
            <h3 className="detail-document-title">Waybill / Delivery Note</h3>
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={waybill.status} />
              <span className="text-sm font-medium text-[var(--surface-muted)]">
                Last updated {formatDateTime(waybill.updatedAt)}
              </span>
            </div>
          </div>

          <div className="detail-document-meta">
            <div className="flex items-center justify-between gap-4">
              <span className="app-label">Waybill number</span>
              <span className="detail-document-number">
                {waybill.waybillNumber}
              </span>
            </div>
            <div className="mt-4 flex items-center justify-between gap-4 text-sm">
              <span className="app-label">Client</span>
              <span className="text-[var(--surface-ink)]">
                {waybill.client?.name ?? 'No client'}
              </span>
            </div>
            <div className="mt-4 flex items-center justify-between gap-4 text-sm">
              <span className="app-label">Date issued</span>
              <span className="text-[var(--surface-ink)]">{formatDate(waybill.createdAt)}</span>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <a
                href={waybillPdfUrl(waybill.id)}
                target="_blank"
                rel="noreferrer"
                className="document-link"
              >
                Open waybill PDF
              </a>
              {waybill.pod ? (
                <a
                  href={podPdfUrl(waybill.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="document-link"
                >
                  Open POD PDF
                </a>
              ) : null}
            </div>
          </div>
        </div>

        <div className="bento-grid">
          {detailBands(waybill).map((item) => (
            <div key={item.title} className={`bento-card ${item.tone} ${item.span}`}>
              <p className="data-label">{item.title}</p>
              <p className="mt-3 text-lg font-semibold leading-tight text-[var(--surface-ink)]">
                {item.value}
              </p>
              <p className="mt-2 text-sm text-[var(--surface-muted)]">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="detail-context-grid">
        <div className="detail-context-main">
          <Panel
            title="Delivery brief"
            copy="Core recipient, location, and payment context for the active delivery."
          >
            <CustomerBrief waybill={waybill} />
          </Panel>
          <Panel
            title="Assigned rider"
            copy="The current rider profile tied to this delivery."
          >
            <RiderProfileCard rider={waybill.assignedRider} />
          </Panel>
        </div>

        <div className="detail-context-side">
          <Panel
            title="Operational actions"
            copy="Use only the actions allowed for the current state."
            tone="soft"
          >
            {actions.length > 0 ? (
              <div className="space-y-3">
                <textarea
                  value={statusNote}
                  onChange={(event) => setStatusNote(event.target.value)}
                  placeholder="Optional note for the status change"
                  className="app-textarea min-h-24"
                />
                <div className="flex flex-wrap gap-3">
                  {actions.map((action) => (
                    <button
                      key={action.value}
                      type="button"
                      onClick={() => void updateStatus(action.value)}
                      className={
                        action.value === 'failed' || action.value === 'cancelled'
                          ? 'btn-secondary'
                          : 'btn-quiet'
                      }
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--surface-muted)]">
                No manual action is available for the current state.
              </p>
            )}
          </Panel>

          {mode === 'ops' && waybill.status === 'created' ? (
            <Panel
              title="Assign rider"
              copy="Choose the rider who should take ownership of this delivery."
              tone="soft"
            >
              <div className="flex flex-wrap gap-3">
                <select
                  value={selectedRider}
                  onChange={(event) => setSelectedRider(event.target.value)}
                  className="app-select w-full sm:min-w-[16rem]"
                >
                  <option value="">Select rider</option>
                  {riders.map((rider) => (
                    <option key={rider.id} value={rider.id}>
                      {rider.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await api.assignWaybill(waybillId, selectedRider, statusNote || undefined)
                      showToast({
                        tone: 'success',
                        title: 'Rider assigned',
                        message: 'The waybill is now assigned to the selected rider.',
                      })
                      setStatusNote('')
                      await load()
                    } catch (caughtError) {
                      const message = errorMessageFrom(caughtError, 'Unable to assign rider.')
                      setError(message)
                      showToast({
                        tone: 'error',
                        title: 'Assignment failed',
                        message,
                      })
                    }
                  }}
                  disabled={!selectedRider}
                  className="btn-primary"
                >
                  Assign rider
                </button>
              </div>
            </Panel>
          ) : null}

          {waybill.status !== 'delivered' && waybill.assignedRider ? (
            <HandoverPanel
              riders={riders.filter((rider) => rider.id !== waybill.assignedRider?.id)}
              selectedRider={selectedRider}
              setSelectedRider={setSelectedRider}
              note={handoverNote}
              setNote={setHandoverNote}
              disabled={!selectedRider}
              onSubmit={handoverWaybill}
            />
          ) : null}

          <ReceiptPanel
            waybill={waybill}
            canManage={
              waybill.status !== 'delivered' &&
              (currentRole === 'admin' ||
                currentRole === 'ops' ||
                waybill.assignedRider?.id === auth.user?.id)
            }
            draftUrl={receiptImageDataUrl}
            previewUrl={receiptImagePreviewUrl}
            busy={receiptBusy}
            onSelect={selectReceiptFile}
            onSave={saveReceipt}
            onClear={() => void clearReceipt()}
          />

          {waybill.status === 'dispatched' && !waybill.pod ? (
            <PodSigningCard
              waybill={waybill}
              recipientName={recipientName}
              setRecipientName={setRecipientName}
              podNote={podNote}
              setPodNote={setPodNote}
              signatureDataUrl={signatureDataUrl}
              setSignatureDataUrl={setSignatureDataUrl}
              onOpenRecipientMode={() => setRecipientModeOpen(true)}
              onSubmit={submitPod}
            />
          ) : null}

          <Panel
            title="Digital acknowledgment"
            copy="Stored proof of delivery signature."
          >
            {waybill.pod ? (
              <div className="media-panel-stack">
                <EvidencePreview
                  src={waybill.pod.signatureFileUrl}
                  alt="Proof of delivery signature"
                  emptyCopy="No proof of delivery has been captured yet."
                  imageClassName="signature-image"
                />
                <p className="text-[11px] leading-6 text-[var(--surface-muted)]">
                  By signing, the receiver acknowledges that the listed goods
                  were delivered in good condition.
                </p>
              </div>
            ) : (
              <p className="text-sm text-[var(--surface-muted)]">
                No proof of delivery has been captured yet.
              </p>
            )}
          </Panel>
        </div>
      </section>

      <section className="detail-audit-stack">
        <Panel
          title="Receiver confirmation"
          copy="Recipient details captured at the moment the delivery is signed off."
        >
          {waybill.pod ? (
            <div className="credential-grid">
              <div className="credential-item">
                <span className="app-label">Recipient</span>
                <p className="data-value">{formatValue(waybill.pod.recipientName, 'Not provided')}</p>
              </div>
              <div className="credential-item">
                <span className="app-label">Delivery time</span>
                <p className="data-value">{formatDateTime(waybill.completionTime)}</p>
              </div>
              <div className="credential-item">
                <span className="app-label">Recipient phone</span>
                <p className="data-value">{waybill.customerPhone}</p>
              </div>
              <div className="credential-item credential-wide">
                <span className="app-label">Location</span>
                <p className="data-value">{waybill.deliveryAddress}</p>
              </div>
              <div className="credential-item">
                <span className="app-label">Delivery method</span>
                <p className="data-value">{deliveryMethodLabel(waybill.deliveryMethod)}</p>
              </div>
              {waybill.pod.note ? (
                <div className="credential-item credential-wide">
                  <span className="app-label">Review</span>
                  <p className="data-value">{waybill.pod.note}</p>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-[var(--surface-muted)]">
              Receiver details will appear here after proof of delivery is captured.
            </p>
          )}
        </Panel>

        <Panel
          title="Handover history"
          copy="Shift replacement and rider signover events recorded against this waybill."
        >
          {waybill.handovers.length > 0 ? (
            <div className="space-y-3">
              {waybill.handovers.map((handover) => (
                <div key={handover.id} className="status-log">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-medium text-[var(--primary)]">
                      {handover.fromRiderName ?? 'Unassigned'} to {handover.toRiderName ?? 'Unknown rider'}
                    </p>
                    <p className="text-xs text-[var(--surface-muted)]">
                      {formatDateTime(handover.handedOverAt)}
                    </p>
                  </div>
                  <p className="mt-1 text-sm text-[var(--surface-muted)]">
                    Recorded by {handover.createdBy ?? 'Unknown user'}
                  </p>
                  {handover.note ? (
                    <p className="mt-2 text-sm text-[var(--surface-ink)]">{handover.note}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--surface-muted)]">
              No rider handover has been recorded for this waybill.
            </p>
          )}
        </Panel>

        <Panel
          title="Status history"
          copy="A complete audit trail of delivery state changes."
        >
          <div className="space-y-3">
            {waybill.statusLogs.map((log) => (
              <div key={log.id} className="status-log">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-medium text-[var(--primary)]">
                    {log.fromStatus} to {log.toStatus}
                  </p>
                  <p className="text-xs text-[var(--surface-muted)]">
                    {formatDateTime(log.changedAt)}
                  </p>
                </div>
                <p className="mt-1 text-sm text-[var(--surface-muted)]">
                  Changed by {log.changedBy ?? 'Unknown'}
                </p>
                {log.note ? (
                  <p className="mt-2 text-sm text-[var(--surface-ink)]">{log.note}</p>
                ) : null}
              </div>
            ))}
            {waybill.statusLogs.length === 0 ? (
              <p className="text-sm text-[var(--surface-muted)]">No status history yet.</p>
            ) : null}
          </div>
        </Panel>
      </section>

      <div className="terms-box">
        <p className="app-label text-[var(--secondary)]">Operating standards</p>
        <p className="mt-2 text-sm leading-7 text-[var(--surface-muted)]">
          This document reflects the live operational record. Claims for failed
          or incomplete deliveries should be resolved against the status log,
          rider assignment, and proof of delivery stored in the system.
        </p>
      </div>

      <RecipientModeOverlay
        open={recipientModeOpen}
        onClose={() => setRecipientModeOpen(false)}
        waybill={waybill}
      >
        <PodSigningForm
          waybill={waybill}
          recipientName={recipientName}
          setRecipientName={setRecipientName}
          podNote={podNote}
          setPodNote={setPodNote}
          signatureDataUrl={signatureDataUrl}
          setSignatureDataUrl={setSignatureDataUrl}
          immersive
          onSubmit={submitPod}
        />
      </RecipientModeOverlay>
    </div>
  )
}

export function OpsWaybillDetailPage({ waybillId }: { waybillId: string }) {
  return (
    <ProtectedScreen
      roles={['admin', 'ops']}
      title="Waybill Detail"
      subtitle="Assign riders, move the status forward, and verify proof of delivery."
      headerVariant="compact"
      actions={
        <Link
          to="/ops/waybills"
          className="btn-quiet"
        >
          Back to list
        </Link>
      }
    >
      <WaybillDetailScreen mode="ops" waybillId={waybillId} />
    </ProtectedScreen>
  )
}

export function RiderJobsPage() {
  const { showToast } = useToast()
  const [items, setItems] = useState<WaybillSummary[]>([])
  const [riders, setRiders] = useState<User[]>([])
  const [shiftDashboard, setShiftDashboard] = useState<ShiftDashboard | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [shiftNote, setShiftNote] = useState('')
  const [shiftHandoverRiderId, setShiftHandoverRiderId] = useState('')
  const [shiftHandoverNote, setShiftHandoverNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [response, dashboard, riderResponse] = await Promise.all([
          api.listWaybills(),
          api.getMyShiftDashboard(),
          api.listUsers({ role: 'rider', active: true }),
        ])
        if (!cancelled) {
          setItems(response.items)
          setShiftDashboard(dashboard)
          setRiders(riderResponse.items)
          setSelectedIds((current) =>
            current.filter((id) =>
              response.items.some((item) => item.id === id && item.status === 'assigned'),
            ),
          )
        }
      } catch (caughtError) {
        if (!cancelled) {
          const message = errorMessageFrom(caughtError, 'Unable to load rider jobs.')
          setError(message)
          showToast({
            tone: 'error',
            title: 'Jobs failed to load',
            message,
          })
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const readyToDispatch = items.filter((item) => item.status === 'assigned')

  async function reloadRiderWorkspace() {
    const [response, dashboard, riderResponse] = await Promise.all([
      api.listWaybills(),
      api.getMyShiftDashboard(),
      api.listUsers({ role: 'rider', active: true }),
    ])
    setItems(response.items)
    setShiftDashboard(dashboard)
    setRiders(riderResponse.items)
  }

  async function dispatchSelected() {
    if (selectedIds.length === 0) {
      return
    }

    try {
      await api.batchDispatchWaybills(selectedIds)
      showToast({
        tone: 'success',
        title: 'Waybills dispatched',
        message: `${selectedIds.length} waybill${selectedIds.length === 1 ? '' : 's'} moved into the live route.`,
      })
      setSelectedIds([])
      await reloadRiderWorkspace()
    } catch (caughtError) {
      const message = errorMessageFrom(caughtError, 'Unable to dispatch the selected waybills.')
      setError(message)
      showToast({
        tone: 'error',
        title: 'Batch dispatch failed',
        message,
      })
    }
  }

  function toggleSelection(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    )
  }

  async function checkInShift() {
    try {
      const dashboard = await api.checkInShift({
        note: shiftNote || null,
      })
      setShiftDashboard(dashboard)
      setShiftNote('')
      showToast({
        tone: 'success',
        title: 'Shift started',
        message: 'Your shift has been checked in and is now active.',
      })
    } catch (caughtError) {
      const message = errorMessageFrom(caughtError, 'Unable to check in to shift.')
      setError(message)
      showToast({
        tone: 'error',
        title: 'Shift check-in failed',
        message,
      })
    }
  }

  async function checkOutShift() {
    try {
      const dashboard = await api.checkOutShift()
      setShiftDashboard(dashboard)
      setSelectedIds([])
      showToast({
        tone: 'success',
        title: 'Shift ended',
        message: 'Your shift has been checked out.',
      })
    } catch (caughtError) {
      const message = errorMessageFrom(caughtError, 'Unable to check out of shift.')
      setError(message)
      showToast({
        tone: 'error',
        title: 'Shift check-out failed',
        message,
      })
    }
  }

  async function startShiftHandover() {
    if (!shiftHandoverRiderId) {
      return
    }

    try {
      const dashboard = await api.startShiftHandover({
        incomingRiderId: shiftHandoverRiderId,
        note: shiftHandoverNote || null,
      })
      setShiftDashboard(dashboard)
      setShiftHandoverRiderId('')
      setShiftHandoverNote('')
      showToast({
        tone: 'success',
        title: 'Handover started',
        message: 'The incoming rider can now confirm the shift change from their account.',
      })
    } catch (caughtError) {
      const message = errorMessageFrom(caughtError, 'Unable to start the shift handover.')
      setError(message)
      showToast({
        tone: 'error',
        title: 'Shift handover failed',
        message,
      })
    }
  }

  async function acceptShiftHandover(handoverId: string) {
    try {
      const dashboard = await api.acceptShiftHandover(handoverId)
      setShiftDashboard(dashboard)
      showToast({
        tone: 'success',
        title: 'Shift handover accepted',
        message: 'Your shift is now active and the handover has been recorded.',
      })
    } catch (caughtError) {
      const message = errorMessageFrom(caughtError, 'Unable to accept the shift handover.')
      setError(message)
      showToast({
        tone: 'error',
        title: 'Shift acceptance failed',
        message,
      })
    }
  }

  return (
    <ProtectedScreen
      roles={['rider']}
      title="My Jobs"
      subtitle="Create deliveries in the field, track active jobs, and hand over the shift cleanly when another rider takes over."
      actions={
        <div className="action-cluster">
          <button
            type="button"
            className="btn-quiet"
            onClick={() =>
              setSelectedIds(
                selectedIds.length === readyToDispatch.length
                  ? []
                  : readyToDispatch.map((item) => item.id),
              )
            }
            disabled={readyToDispatch.length === 0 || !shiftDashboard?.activeShift}
          >
            {selectedIds.length === readyToDispatch.length && readyToDispatch.length > 0
              ? 'Clear queued'
              : 'Select queued'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => void dispatchSelected()}
            disabled={selectedIds.length === 0 || !shiftDashboard?.activeShift}
          >
            Dispatch selected
          </button>
          <Link
            to="/rider/jobs/new"
            className={`btn-primary ${shiftDashboard?.activeShift ? '' : 'pointer-events-none opacity-60'}`}
          >
            New delivery
          </Link>
        </div>
      }
    >
      {error ? <Message tone="error">{error}</Message> : null}
      {!loading && shiftDashboard?.pendingIncomingHandovers.length ? (
        <Message tone="info">
          {shiftDashboard.pendingIncomingHandovers.length} pending shift handover
          {shiftDashboard.pendingIncomingHandovers.length === 1 ? '' : 's'} need
          confirmation from the incoming rider.
        </Message>
      ) : null}
      {!loading && items.filter((item) => item.status === 'failed').length > 0 ? (
        <Message tone="info">
          {items.filter((item) => item.status === 'failed').length} failed delivery
          {items.filter((item) => item.status === 'failed').length === 1 ? ' is' : 'ies are'} still
          visible and may need follow-up or return handling.
        </Message>
      ) : null}
      {!loading ? (
        <Panel
          title="Shift workspace"
          copy="Check in before route work starts, use handover when a new rider takes over, and keep the timeline clean."
        >
          <div className="sheet-stack">
            <div className="compact-fact-grid">
              <div className="compact-fact">
                <p className="data-label">Active shift</p>
                <p className="data-value">
                  {shiftDashboard?.activeShift ? 'Checked in' : 'Not checked in'}
                </p>
              </div>
              <div className="compact-fact">
                <p className="data-label">Check-in time</p>
                <p className="data-value">
                  {formatDateTime(shiftDashboard?.activeShift?.checkInAt)}
                </p>
              </div>
              <div className="compact-fact">
                <p className="data-label">Pending incoming</p>
                <p className="data-value">{shiftDashboard?.pendingIncomingHandovers.length ?? 0}</p>
              </div>
              <div className="compact-fact">
                <p className="data-label">Pending outgoing</p>
                <p className="data-value">{shiftDashboard?.pendingOutgoingHandovers.length ?? 0}</p>
              </div>
            </div>

            {!shiftDashboard?.activeShift ? (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="space-y-3">
                  {shiftDashboard?.pendingIncomingHandovers.length ? (
                    <div className="space-y-3">
                      {shiftDashboard.pendingIncomingHandovers.map((handover) => (
                        <div key={handover.id} className="status-log">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm font-medium text-[var(--primary)]">
                              Incoming shift from {handover.outgoingRiderName ?? 'another rider'}
                            </p>
                            <p className="text-xs text-[var(--surface-muted)]">
                              {formatDateTime(handover.initiatedAt)}
                            </p>
                          </div>
                          <p className="mt-1 text-sm text-[var(--surface-muted)]">
                            The outgoing rider has already confirmed the handover.
                          </p>
                          {handover.note ? (
                            <p className="mt-2 text-sm text-[var(--surface-ink)]">{handover.note}</p>
                          ) : null}
                          <div className="mt-3">
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={() => void acceptShiftHandover(handover.id)}
                            >
                              Accept shift handover
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <textarea
                        value={shiftNote}
                        onChange={(event) => setShiftNote(event.target.value)}
                        placeholder="Optional shift check-in note"
                        className="app-textarea min-h-24"
                      />
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => void checkInShift()}
                      >
                        Check in to shift
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <p className="app-label">Shift timeline</p>
                  <div className="space-y-3">
                    {shiftDashboard?.timeline.map((item) => (
                      <div key={item.id} className="status-log">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-sm font-medium text-[var(--primary)]">{item.title}</p>
                          <p className="text-xs text-[var(--surface-muted)]">
                            {formatDateTime(item.timestamp)}
                          </p>
                        </div>
                        <p className="mt-2 text-sm text-[var(--surface-muted)]">{item.detail}</p>
                      </div>
                    ))}
                    {shiftDashboard?.timeline.length === 0 ? (
                      <p className="text-sm text-[var(--surface-muted)]">
                        No shift events have been recorded yet.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="space-y-3">
                  {shiftDashboard.pendingOutgoingHandovers.length > 0 ? (
                    shiftDashboard.pendingOutgoingHandovers.map((handover) => (
                      <div key={handover.id} className="status-log">
                        <p className="text-sm font-medium text-[var(--primary)]">
                          Waiting for {handover.incomingRiderName ?? 'incoming rider'} to confirm
                        </p>
                        <p className="mt-1 text-sm text-[var(--surface-muted)]">
                          Your handover was logged at {formatDateTime(handover.outgoingConfirmedAt)}.
                        </p>
                        {handover.note ? (
                          <p className="mt-2 text-sm text-[var(--surface-ink)]">{handover.note}</p>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <>
                      <select
                        value={shiftHandoverRiderId}
                        onChange={(event) => setShiftHandoverRiderId(event.target.value)}
                        className="app-select w-full"
                      >
                        <option value="">Select replacement rider</option>
                        {riders
                          .filter((rider) => rider.id !== shiftDashboard.activeShift?.riderId)
                          .map((rider) => (
                            <option key={rider.id} value={rider.id}>
                              {rider.name}
                            </option>
                          ))}
                      </select>
                      <textarea
                        value={shiftHandoverNote}
                        onChange={(event) => setShiftHandoverNote(event.target.value)}
                        placeholder="Optional note for the incoming rider"
                        className="app-textarea min-h-24"
                      />
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => void startShiftHandover()}
                        disabled={!shiftHandoverRiderId}
                      >
                        Start shift handover
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="btn-quiet"
                    onClick={() => void checkOutShift()}
                    disabled={shiftDashboard.pendingOutgoingHandovers.length > 0}
                  >
                    Check out without replacement
                  </button>
                </div>

                <div className="space-y-3">
                  <p className="app-label">Shift timeline</p>
                  <div className="space-y-3">
                    {shiftDashboard?.timeline.map((item) => (
                      <div key={item.id} className="status-log">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-sm font-medium text-[var(--primary)]">{item.title}</p>
                          <p className="text-xs text-[var(--surface-muted)]">
                            {formatDateTime(item.timestamp)}
                          </p>
                        </div>
                        <p className="mt-2 text-sm text-[var(--surface-muted)]">{item.detail}</p>
                      </div>
                    ))}
                    {shiftDashboard?.timeline.length === 0 ? (
                      <p className="text-sm text-[var(--surface-muted)]">
                        No shift events have been recorded yet.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          </div>
        </Panel>
      ) : null}
      {!loading ? (
        <div className="inline-stat-grid">
          {[
            ['Queued', items.filter((item) => item.status === 'assigned').length],
            ['Dispatched', items.filter((item) => item.status === 'dispatched').length],
            ['Exceptions', items.filter((item) => item.status === 'failed').length],
            ['Visible jobs', items.length],
          ].map(([label, value]) => (
            <div key={label} className="inline-stat">
              <p className="data-label">{label}</p>
              <p className="inline-stat-value">{value}</p>
            </div>
          ))}
        </div>
      ) : null}
      {loading ? (
        loadingTable('Loading jobs...')
      ) : (
        <div className="grid gap-4">
          {readyToDispatch.length > 0 ? (
            <div className="alert info">
              Select the queued waybills you want to leave with, then use <strong>Dispatch selected</strong>.
            </div>
          ) : null}
          {items.map((item) => (
            <div key={item.id} className="list-card">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  {item.status === 'assigned' ? (
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={() => toggleSelection(item.id)}
                      className="mt-1 h-4 w-4"
                    />
                  ) : null}
                  <div className="space-y-1">
                    <p className="font-['Manrope'] text-sm font-extrabold uppercase tracking-[0.12em] text-[var(--primary)]">
                      {item.waybillNumber}
                    </p>
                    <p className="text-sm font-medium text-[var(--surface-ink)]">
                      {recipientLabel(item.customerName)}
                    </p>
                    <p className="text-sm text-[var(--surface-muted)]">{item.deliveryAddress}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={item.status} />
                  <Link
                    to="/rider/jobs/$waybillId"
                    params={{ waybillId: item.id }}
                    className="btn-quiet"
                  >
                    Open
                  </Link>
                </div>
              </div>
              <div className="list-card-meta">
                <div className="data-card">
                  <p className="data-label">Recipient phone</p>
                  <p className="data-value">{item.customerPhone}</p>
                </div>
                <div className="data-card">
                  <p className="data-label">Dispatch time</p>
                  <p className="data-value">{formatDateTime(item.dispatchTime)}</p>
                </div>
                <div className="data-card">
                  <p className="data-label">Delivery method</p>
                  <p className="data-value">{deliveryMethodLabel(item.deliveryMethod)}</p>
                </div>
              </div>
            </div>
          ))}
          {items.length === 0 ? (
            <Message tone="info">No active jobs are assigned to you.</Message>
          ) : null}
        </div>
      )}
    </ProtectedScreen>
  )
}

export function RiderWaybillDetailPage({ waybillId }: { waybillId: string }) {
  return (
    <ProtectedScreen
      roles={['rider']}
      title="Job Detail"
      subtitle="Dispatch the job, capture the signature, and complete the delivery."
      headerVariant="compact"
      actions={
        <Link
          to="/rider/jobs"
          className="btn-quiet"
        >
          Back to jobs
        </Link>
      }
    >
      <WaybillDetailScreen mode="rider" waybillId={waybillId} />
    </ProtectedScreen>
  )
}
