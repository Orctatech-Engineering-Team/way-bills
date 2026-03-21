import { useEffect, useState, type ReactNode } from 'react'
import { ProtectedScreen } from '../components/AppLayout'
import { useToast } from '../feedback/ToastProvider'
import { api, invoicePdfUrl } from '../lib/api'
import { buildCsv, downloadCsv } from '../lib/export'
import { errorMessageFrom } from '../lib/feedback'
import type { Client, InvoiceDetail, InvoiceStatus, InvoiceSummary } from '../lib/types'
import {
  dateInputValue,
  endOfBillingWeek,
  formatDate,
  formatMoney,
  formatValue,
  shiftDateByDays,
  startOfBillingWeek,
} from '../lib/utils'

function Panel({
  title,
  copy,
  children,
  actions,
}: {
  title: string
  copy?: string
  children: ReactNode
  actions?: ReactNode
}) {
  return (
    <section className="panel">
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

type InvoiceFormState = {
  clientId: string
  start: string
  end: string
  dueDate: string
  notes: string
}

function buildInitialForm() {
  const now = new Date()
  const lastWeekReference = shiftDateByDays(startOfBillingWeek(now), -1)
  const start = startOfBillingWeek(lastWeekReference)
  const end = endOfBillingWeek(lastWeekReference)

  return {
    clientId: '',
    start: dateInputValue(start),
    end: dateInputValue(end),
    dueDate: '',
    notes: '',
  }
}

function invoiceStatusLabel(status: InvoiceStatus) {
  if (status === 'paid') return 'Paid'
  if (status === 'void') return 'Void'
  return 'Issued'
}

function invoiceEmailHref(invoice: InvoiceDetail) {
  if (!invoice.client.contactEmail) {
    return null
  }

  const subject = encodeURIComponent(`Invoice ${invoice.invoiceNumber}`)
  const body = encodeURIComponent(
    [
      `Hello ${invoice.client.contactName ?? invoice.client.name},`,
      '',
      `Please find invoice ${invoice.invoiceNumber} for deliveries completed between ${formatDate(invoice.periodStart)} and ${formatDate(invoice.periodEnd)}.`,
      '',
      `Total: ${formatMoney(invoice.subtotalCents, invoice.currency)}`,
      `PDF: ${invoicePdfUrl(invoice.id)}`,
    ].join('\n'),
  )

  return `mailto:${invoice.client.contactEmail}?subject=${subject}&body=${body}`
}

export function InvoicesPage() {
  const { showToast } = useToast()
  const [clients, setClients] = useState<Client[]>([])
  const [items, setItems] = useState<InvoiceSummary[]>([])
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDetail | null>(null)
  const [filters, setFilters] = useState({ clientId: '', status: '' })
  const [form, setForm] = useState<InvoiceFormState>(buildInitialForm())
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')

  function exportInvoiceRegister() {
    const csv = buildCsv(
      ['Invoice', 'Client', 'Period Start', 'Period End', 'Amount', 'Status', 'Issued At', 'Due At'],
      items.map((item) => [
        item.invoiceNumber,
        item.clientName,
        formatDate(item.periodStart),
        formatDate(item.periodEnd),
        item.subtotalCents,
        item.status,
        formatDate(item.issuedAt),
        formatDate(item.dueAt),
      ]),
    )
    downloadCsv('invoice-register.csv', csv)
  }

  function exportSelectedInvoiceItems() {
    if (!selectedInvoice) {
      return
    }

    const csv = buildCsv(
      ['Invoice', 'Waybill', 'Order Reference', 'Recipient', 'Completed', 'Tier', 'Amount'],
      selectedInvoice.items.map((item) => [
        selectedInvoice.invoiceNumber,
        item.waybillNumber,
        item.orderReference,
        formatValue(item.customerName, 'No recipient name'),
        formatDate(item.completionTime),
        item.pricingTier,
        item.amountCents,
      ]),
    )
    downloadCsv(`${selectedInvoice.invoiceNumber.toLowerCase()}-items.csv`, csv)
  }

  async function load(selectedId?: string | null) {
    setLoading(true)
    setError('')

    try {
      const [clientResponse, invoiceResponse] = await Promise.all([
        api.listClients({ active: true }),
        api.listInvoices({
          clientId: filters.clientId || undefined,
          status: filters.status || undefined,
        }),
      ])

      setClients(clientResponse.items)
      setItems(invoiceResponse.items)

      const nextId = selectedId ?? selectedInvoice?.id ?? invoiceResponse.items[0]?.id ?? null
      if (nextId) {
        await loadInvoice(nextId)
      } else {
        setSelectedInvoice(null)
      }
    } catch (caughtError) {
      setError(errorMessageFrom(caughtError, 'Unable to load invoices.'))
    } finally {
      setLoading(false)
    }
  }

  async function loadInvoice(id: string) {
    setDetailLoading(true)

    try {
      const response = await api.getInvoice(id)
      setSelectedInvoice(response.invoice)
    } catch (caughtError) {
      setError(errorMessageFrom(caughtError, 'Unable to load invoice detail.'))
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [filters.clientId, filters.status])

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreating(true)
    setError('')

    try {
      const response = await api.createInvoice({
        clientId: form.clientId,
        start: form.start,
        end: form.end,
        dueDate: form.dueDate || undefined,
        notes: form.notes || null,
      })

      setForm(buildInitialForm())
      showToast({
        tone: 'success',
        title: 'Invoice created',
        message: `${response.invoice.invoiceNumber} was generated successfully.`,
      })
      await load(response.invoice.id)
    } catch (caughtError) {
      const message = errorMessageFrom(caughtError, 'Unable to generate invoice.')
      setError(message)
      showToast({
        tone: 'error',
        title: 'Invoice generation failed',
        message,
      })
    } finally {
      setCreating(false)
    }
  }

  async function changeStatus(status: 'paid' | 'void') {
    if (!selectedInvoice) {
      return
    }

    try {
      await api.updateInvoiceStatus(selectedInvoice.id, status)
      showToast({
        tone: status === 'void' ? 'warning' : 'success',
        title: status === 'void' ? 'Invoice voided' : 'Invoice marked paid',
        message: `${selectedInvoice.invoiceNumber} is now ${status}.`,
      })
      await load(selectedInvoice.id)
    } catch (caughtError) {
      const message = errorMessageFrom(caughtError, 'Unable to update invoice status.')
      setError(message)
      showToast({
        tone: 'error',
        title: 'Invoice update failed',
        message,
      })
    }
  }

  const totalValue = items.reduce((sum, item) => sum + item.subtotalCents, 0)

  return (
    <ProtectedScreen
      roles={['admin', 'ops']}
      title="Invoices"
      subtitle="Generate client invoices from delivered waybills, review line items, and mark payment state."
    >
      {error ? <div className="alert error">{error}</div> : null}
      {!loading && items.length > 0 ? (
        <div className="alert info">
          Use the previous-week defaults to generate client invoices on a weekly rhythm, then export or email the result for accounting.
        </div>
      ) : null}

      <div className="inline-stat-grid">
        <div className="inline-stat">
          <p className="data-label">Invoice records</p>
          <p className="inline-stat-value">{items.length}</p>
        </div>
        <div className="inline-stat">
          <p className="data-label">Issued value</p>
          <p className="inline-stat-value">{formatMoney(totalValue)}</p>
        </div>
      </div>

      <div className="sheet-grid aside">
        <Panel
          title="Generate invoice"
          copy="Create the weekly client invoice from delivered, uninvoiced waybills inside one billing window."
        >
          <form className="grid gap-4 lg:grid-cols-2" onSubmit={handleCreate}>
            <label className="field-stack lg:col-span-2">
              <span className="app-label">Client</span>
              <select
                value={form.clientId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, clientId: event.target.value }))
                }
                className="app-select"
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
              <span className="app-label">Start date</span>
              <input
                type="date"
                value={form.start}
                onChange={(event) => setForm((current) => ({ ...current, start: event.target.value }))}
                className="app-input"
                required
              />
            </label>

            <label className="field-stack">
              <span className="app-label">End date</span>
              <input
                type="date"
                value={form.end}
                onChange={(event) => setForm((current) => ({ ...current, end: event.target.value }))}
                className="app-input"
                required
              />
            </label>

            <label className="field-stack">
              <span className="app-label">Due date</span>
              <input
                type="date"
                value={form.dueDate}
                onChange={(event) =>
                  setForm((current) => ({ ...current, dueDate: event.target.value }))
                }
                className="app-input"
              />
            </label>

            <label className="field-stack">
              <span className="app-label">Notes</span>
              <input
                type="text"
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                className="app-input"
                placeholder="Optional billing note"
              />
            </label>

            <div className="lg:col-span-2 flex justify-end">
              <button type="submit" disabled={creating} className="btn-primary">
                {creating ? 'Generating...' : 'Generate invoice'}
              </button>
            </div>
          </form>
        </Panel>

        <div className="sheet-stack">
          <div className="sheet-note">
            <p className="app-label">Weekly billing</p>
            <p className="sheet-note-copy">
              The form defaults to the previous billing week so operations can generate client
              invoices on a weekly cadence without rebuilding the date range each time.
            </p>
          </div>
        </div>
      </div>

      <Panel
        title="Invoice register"
        copy="Filter all issued billing documents by client or payment state."
        actions={
          items.length > 0 ? (
            <button type="button" className="btn-secondary" onClick={exportInvoiceRegister}>
              Export CSV
            </button>
          ) : null
        }
      >
        <div className="mb-5 grid gap-4 md:grid-cols-2">
          <label className="field-stack">
            <span className="app-label">Client filter</span>
            <select
              value={filters.clientId}
              onChange={(event) =>
                setFilters((current) => ({ ...current, clientId: event.target.value }))
              }
              className="app-select"
            >
              <option value="">All clients</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field-stack">
            <span className="app-label">Status filter</span>
            <select
              value={filters.status}
              onChange={(event) =>
                setFilters((current) => ({ ...current, status: event.target.value }))
              }
              className="app-select"
            >
              <option value="">All statuses</option>
              <option value="issued">Issued</option>
              <option value="paid">Paid</option>
              <option value="void">Void</option>
            </select>
          </label>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--surface-muted)]">Loading invoices...</p>
        ) : (
          <>
            <div className="table-shell desktop-only">
              <table className="editorial-table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Client</th>
                    <th>Period</th>
                    <th>Amount</th>
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
                          onClick={() => void loadInvoice(item.id)}
                        >
                          {item.invoiceNumber}
                        </button>
                        <p className="mt-1 text-[var(--surface-muted)]">{formatDate(item.issuedAt)}</p>
                      </td>
                      <td className="text-[var(--surface-muted)]">{item.clientName}</td>
                      <td className="text-[var(--surface-muted)]">
                        {formatDate(item.periodStart)} to {formatDate(item.periodEnd)}
                      </td>
                      <td className="text-[var(--surface-muted)]">
                        {formatMoney(item.subtotalCents, item.currency)}
                      </td>
                      <td>
                        <span className={`status-pill ${item.status === 'paid' ? 'success' : item.status === 'void' ? 'neutral' : 'info'}`}>
                          {invoiceStatusLabel(item.status)}
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
                  onClick={() => void loadInvoice(item.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-['Manrope'] text-sm font-extrabold text-[var(--primary)]">
                        {item.invoiceNumber}
                      </p>
                      <p className="mt-1 text-sm text-[var(--surface-muted)]">{item.clientName}</p>
                    </div>
                    <span className={`status-pill ${item.status === 'paid' ? 'success' : item.status === 'void' ? 'neutral' : 'info'}`}>
                      {invoiceStatusLabel(item.status)}
                    </span>
                  </div>
                  <div className="mobile-record-row">
                    <div className="data-card">
                      <p className="data-label">Period</p>
                      <p className="data-value">{formatDate(item.periodStart)} to {formatDate(item.periodEnd)}</p>
                    </div>
                    <div className="data-card">
                      <p className="data-label">Amount</p>
                      <p className="data-value">{formatMoney(item.subtotalCents, item.currency)}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </Panel>

      <Panel
        title="Selected invoice"
        copy="Review line items, open the PDF, and update the payment state."
        actions={
          selectedInvoice ? (
            <div className="action-cluster">
              <button type="button" className="btn-secondary" onClick={exportSelectedInvoiceItems}>
                Export line items
              </button>
              <a
                href={invoicePdfUrl(selectedInvoice.id)}
                target="_blank"
                rel="noreferrer"
                className="document-link"
              >
                Open invoice PDF
              </a>
              {invoiceEmailHref(selectedInvoice) ? (
                <a href={invoiceEmailHref(selectedInvoice)!} className="document-link">
                  Prepare client email
                </a>
              ) : null}
            </div>
          ) : null
        }
      >
        {detailLoading ? (
          <p className="text-sm text-[var(--surface-muted)]">Loading invoice detail...</p>
        ) : !selectedInvoice ? (
          <p className="text-sm text-[var(--surface-muted)]">Select an invoice from the register to review it.</p>
        ) : (
          <div className="sheet-stack">
            <div className="compact-fact-grid">
              <div className="compact-fact">
                <p className="data-label">Client</p>
                <p className="data-value">{selectedInvoice.client.name}</p>
              </div>
              <div className="compact-fact">
                <p className="data-label">Status</p>
                <p className="data-value">{invoiceStatusLabel(selectedInvoice.status)}</p>
              </div>
              <div className="compact-fact">
                <p className="data-label">Due date</p>
                <p className="data-value">{formatDate(selectedInvoice.dueAt)}</p>
              </div>
              <div className="compact-fact">
                <p className="data-label">Subtotal</p>
                <p className="data-value">
                  {formatMoney(selectedInvoice.subtotalCents, selectedInvoice.currency)}
                </p>
              </div>
            </div>

            <div className="action-cluster">
              {selectedInvoice.status !== 'paid' ? (
                <button type="button" className="btn-primary" onClick={() => void changeStatus('paid')}>
                  Mark paid
                </button>
              ) : null}
              {selectedInvoice.status !== 'void' ? (
                <button type="button" className="btn-secondary" onClick={() => void changeStatus('void')}>
                  Void invoice
                </button>
              ) : null}
            </div>

            <div className="table-shell">
              <table className="editorial-table">
                <thead>
                  <tr>
                    <th>Waybill</th>
                    <th>Recipient</th>
                    <th>Completed</th>
                    <th>Tier</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedInvoice.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <p className="font-['Manrope'] font-extrabold text-[var(--primary)]">
                          {item.waybillNumber}
                        </p>
                        <p className="mt-1 text-[var(--surface-muted)]">{item.orderReference}</p>
                      </td>
                      <td className="text-[var(--surface-muted)]">
                        {formatValue(item.customerName, 'No recipient name')}
                      </td>
                      <td className="text-[var(--surface-muted)]">{formatDate(item.completionTime)}</td>
                      <td className="text-[var(--surface-muted)]">{item.pricingTier}</td>
                      <td className="text-[var(--surface-muted)]">
                        {formatMoney(item.amountCents, selectedInvoice.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Panel>
    </ProtectedScreen>
  )
}
