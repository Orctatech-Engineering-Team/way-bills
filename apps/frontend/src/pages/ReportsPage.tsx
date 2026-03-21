import { Link } from '@tanstack/react-router'
import { useEffect, useState, type ReactNode } from 'react'
import { ProtectedScreen } from '../components/AppLayout'
import { useToast } from '../feedback/ToastProvider'
import { api } from '../lib/api'
import { buildCsv, downloadCsv } from '../lib/export'
import { errorMessageFrom } from '../lib/feedback'
import type {
  BillingReportResponse,
  Client,
  ShiftReportResponse,
  User,
  WeeklyReportResponse,
} from '../lib/types'
import {
  dateInputValue,
  formatDate,
  formatDateTime,
  formatMoney,
  formatValue,
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

export function ReportsPage() {
  const { showToast } = useToast()
  const now = new Date()
  const start = new Date(now)
  start.setDate(now.getDate() - 6)

  const [filters, setFilters] = useState({
    start: dateInputValue(start),
    end: dateInputValue(now),
    riderId: '',
    clientId: '',
    onlyUninvoiced: false,
  })
  const [riders, setRiders] = useState<User[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReportResponse | null>(null)
  const [billingReport, setBillingReport] = useState<BillingReportResponse | null>(null)
  const [shiftReport, setShiftReport] = useState<ShiftReportResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  function exportCompletedDeliveries() {
    if (!weeklyReport) {
      return
    }

    const csv = buildCsv(
      ['Waybill', 'Order Reference', 'Recipient', 'Signed Recipient', 'Rider', 'Completed'],
      weeklyReport.items.map((item) => [
        item.waybillNumber,
        item.orderReference,
        formatValue(item.customerName, 'No recipient name'),
        item.recipientName ?? '',
        item.riderName ?? 'Unassigned',
        formatDateTime(item.completionTime),
      ]),
    )
    downloadCsv(`completed-deliveries-${filters.start}-to-${filters.end}.csv`, csv)
  }

  function exportBillingSummary() {
    if (!billingReport) {
      return
    }

    const csv = buildCsv(
      ['Client', 'Delivered', 'Total Amount', 'Invoiced Amount', 'Uninvoiced Amount', 'Uninvoiced Count'],
      billingReport.grouped.map((group) => [
        group.clientName ?? 'No client attached',
        group.delivered,
        group.totalAmountCents,
        group.invoicedAmountCents,
        group.uninvoicedAmountCents,
        group.uninvoicedCount,
      ]),
    )
    downloadCsv(`billing-summary-${filters.start}-to-${filters.end}.csv`, csv)
  }

  function exportShiftTimeline() {
    if (!shiftReport) {
      return
    }

    const csv = buildCsv(
      ['Timestamp', 'Rider', 'Event', 'Detail'],
      shiftReport.timeline.map((item) => [
        item.timestamp,
        item.riderName ?? 'Unknown rider',
        item.title,
        item.detail,
      ]),
    )
    downloadCsv(`shift-timeline-${filters.start}-to-${filters.end}.csv`, csv)
  }

  async function load() {
    setLoading(true)
    setError('')

    try {
      const [weeklyResponse, billingResponse, shiftResponse, riderResponse, clientResponse] =
        await Promise.all([
          api.getWeeklyReport({
            start: filters.start,
            end: filters.end,
            riderId: filters.riderId || undefined,
          }),
          api.getBillingReport({
            start: filters.start,
            end: filters.end,
            clientId: filters.clientId || undefined,
            invoiceStatus: filters.onlyUninvoiced ? 'uninvoiced' : undefined,
          }),
          api.getShiftReport({
            start: filters.start,
            end: filters.end,
            riderId: filters.riderId || undefined,
          }),
          api.listUsers({ role: 'rider', active: true }),
          api.listClients({ active: true }),
        ])

      setWeeklyReport(weeklyResponse)
      setBillingReport(billingResponse)
      setShiftReport(shiftResponse)
      setRiders(riderResponse.items)
      setClients(clientResponse.items)
    } catch (caughtError) {
      const message = errorMessageFrom(
        caughtError,
        'Unable to load the reports workspace.',
      )
      setError(message)
      showToast({
        tone: 'error',
        title: 'Reports failed to load',
        message,
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [
    filters.clientId,
    filters.end,
    filters.onlyUninvoiced,
    filters.riderId,
    filters.start,
  ])

  return (
    <ProtectedScreen
      roles={['admin', 'ops']}
      title="Reports"
      subtitle="Review delivery execution and billable completion volume from one reporting surface."
    >
      {error ? <div className="alert error">{error}</div> : null}
      {!loading && billingReport && billingReport.totals.uninvoicedAmountCents > 0 ? (
        <div className="alert info">
          {formatMoney(billingReport.totals.uninvoicedAmountCents)} remains uninvoiced in this window.
          Review invoices when the weekly billing run is due.
        </div>
      ) : null}
      {!loading && shiftReport && shiftReport.totals.activeShifts > 0 ? (
        <div className="alert info">
          {shiftReport.totals.activeShifts} rider shift
          {shiftReport.totals.activeShifts === 1 ? ' is' : 's are'} still active in the selected window.
        </div>
      ) : null}

      <div className="sheet-grid aside">
        <Panel title="Filters" copy="Apply one date window across both operations and billing views.">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <label className="field-stack">
              <span className="app-label">Start date</span>
              <input
                type="date"
                value={filters.start}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, start: event.target.value }))
                }
                className="app-input"
              />
            </label>

            <label className="field-stack">
              <span className="app-label">End date</span>
              <input
                type="date"
                value={filters.end}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, end: event.target.value }))
                }
                className="app-input"
              />
            </label>

            <label className="field-stack">
              <span className="app-label">Rider</span>
              <select
                value={filters.riderId}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, riderId: event.target.value }))
                }
                className="app-select"
              >
                <option value="">All riders</option>
                {riders.map((rider) => (
                  <option key={rider.id} value={rider.id}>
                    {rider.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-stack">
              <span className="app-label">Client</span>
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

            <label className="field-checkbox">
              <input
                type="checkbox"
                checked={filters.onlyUninvoiced}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    onlyUninvoiced: event.target.checked,
                  }))
                }
              />
              <span>Only show uninvoiced billable deliveries.</span>
            </label>
          </div>
        </Panel>

        <div className="sheet-stack">
          <div className="sheet-note">
            <p className="app-label">Reporting window</p>
            <p className="inline-stat-value !mt-3 !text-[1.45rem]">
              {filters.start} to {filters.end}
            </p>
          </div>
          <div className="sheet-note">
            <p className="app-label">Invoice workflow</p>
            <p className="sheet-note-copy">
              Use the billing summary to review weekly delivery totals, then move to invoices to
              generate the client billing document for that same week.
            </p>
            <div className="mt-4">
              <Link to="/ops/invoices" className="btn-secondary">
                Open invoices
              </Link>
            </div>
          </div>
        </div>
      </div>

      <Panel title="Operations totals" copy="Delivery execution for the selected period.">
        {loading || !weeklyReport ? (
          <p className="text-sm text-[var(--surface-muted)]">Loading operational totals...</p>
        ) : (
          <div className="inline-stat-grid">
            <div className="data-card">
              <p className="data-label">Completed deliveries</p>
              <p className="display-number mt-2 text-[var(--primary)]">
                {weeklyReport.totals.completedDeliveries}
              </p>
            </div>
            <div className="data-card">
              <p className="data-label">Active riders</p>
              <p className="display-number mt-2 text-[var(--primary)]">
                {weeklyReport.totals.riders}
              </p>
            </div>
          </div>
        )}
      </Panel>

      <Panel title="Shift totals" copy="Shift check-ins, check-outs, and confirmed replacements in the selected window.">
        {loading || !shiftReport ? (
          <p className="text-sm text-[var(--surface-muted)]">Loading shift totals...</p>
        ) : (
          <div className="inline-stat-grid">
            <div className="data-card">
              <p className="data-label">Check-ins</p>
              <p className="display-number mt-2 text-[var(--primary)]">
                {shiftReport.totals.shiftCheckIns}
              </p>
            </div>
            <div className="data-card">
              <p className="data-label">Check-outs</p>
              <p className="display-number mt-2 text-[var(--primary)]">
                {shiftReport.totals.shiftCheckOuts}
              </p>
            </div>
            <div className="data-card">
              <p className="data-label">Completed handovers</p>
              <p className="display-number mt-2 text-[var(--primary)]">
                {shiftReport.totals.completedHandovers}
              </p>
            </div>
            <div className="data-card">
              <p className="data-label">Still active</p>
              <p className="display-number mt-2 text-[var(--primary)]">
                {shiftReport.totals.activeShifts}
              </p>
            </div>
          </div>
        )}
      </Panel>

      <Panel title="Billing totals" copy="Delivered commercial value across the same reporting window.">
        {loading || !billingReport ? (
          <p className="text-sm text-[var(--surface-muted)]">Loading billing totals...</p>
        ) : (
          <div className="inline-stat-grid">
            <div className="data-card">
              <p className="data-label">Delivered waybills</p>
              <p className="display-number mt-2 text-[var(--primary)]">
                {billingReport.totals.deliveredWaybills}
              </p>
            </div>
            <div className="data-card">
              <p className="data-label">Billable value</p>
              <p className="display-number mt-2 text-[var(--primary)]">
                {formatMoney(billingReport.totals.totalAmountCents)}
              </p>
            </div>
            <div className="data-card">
              <p className="data-label">Uninvoiced value</p>
              <p className="display-number mt-2 text-[var(--primary)]">
                {formatMoney(billingReport.totals.uninvoicedAmountCents)}
              </p>
            </div>
            <div className="data-card">
              <p className="data-label">Clients in range</p>
              <p className="display-number mt-2 text-[var(--primary)]">
                {billingReport.totals.clients}
              </p>
            </div>
          </div>
        )}
      </Panel>

      <Panel
        title="Completed deliveries"
        copy="Operational delivery list, grouped by individual waybill."
        actions={
          weeklyReport ? (
            <button type="button" className="btn-secondary" onClick={exportCompletedDeliveries}>
              Export CSV
            </button>
          ) : null
        }
      >
        {loading || !weeklyReport ? (
          <p className="text-sm text-[var(--surface-muted)]">Loading deliveries...</p>
        ) : (
          <>
            <div className="table-shell desktop-only">
              <table className="editorial-table">
                <thead>
                  <tr>
                    <th>Waybill</th>
                    <th>Recipient</th>
                    <th>Rider</th>
                    <th>Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklyReport.items.map((item) => (
                    <tr key={item.waybillId}>
                      <td>
                        <p className="font-['Manrope'] font-extrabold text-[var(--primary)]">
                          {item.waybillNumber}
                        </p>
                        <p className="mt-1 text-[var(--surface-muted)]">{item.orderReference}</p>
                      </td>
                      <td className="text-[var(--surface-muted)]">
                        <p>{formatValue(item.customerName, 'No recipient name')}</p>
                        <p>{item.recipientName ?? 'Recipient not captured'}</p>
                      </td>
                      <td className="text-[var(--surface-muted)]">{item.riderName ?? 'Unassigned'}</td>
                      <td className="text-[var(--surface-muted)]">{formatDateTime(item.completionTime)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mobile-record-list mobile-only">
              {weeklyReport.items.map((item) => (
                <div key={item.waybillId} className="mobile-record-card">
                  <div>
                    <p className="font-['Manrope'] text-sm font-extrabold text-[var(--primary)]">
                      {item.waybillNumber}
                    </p>
                    <p className="mt-1 text-sm text-[var(--surface-muted)]">{item.orderReference}</p>
                  </div>
                  <div className="mobile-record-row">
                    <div className="data-card">
                      <p className="data-label">Recipient</p>
                      <p className="data-value">{formatValue(item.customerName, 'No recipient name')}</p>
                    </div>
                    <div className="data-card">
                      <p className="data-label">Rider</p>
                      <p className="data-value">{item.riderName ?? 'Unassigned'}</p>
                    </div>
                    <div className="data-card">
                      <p className="data-label">Completed</p>
                      <p className="data-value">{formatDateTime(item.completionTime)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Panel>

      <Panel
        title="Billing summary by client"
        copy="Delivered value, invoiced value, and remaining uninvoiced balance by client."
        actions={
          billingReport ? (
            <button type="button" className="btn-secondary" onClick={exportBillingSummary}>
              Export CSV
            </button>
          ) : null
        }
      >
        {loading || !billingReport ? (
          <p className="text-sm text-[var(--surface-muted)]">Loading billing summary...</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {billingReport.grouped.map((group) => (
              <div key={group.clientId ?? 'unassigned'} className="data-card">
                <p className="data-label">{group.clientName ?? 'No client attached'}</p>
                <p className="data-value !mt-2">{group.delivered} delivered waybills</p>
                <div className="mt-4 space-y-2 text-sm text-[var(--surface-muted)]">
                  <p>Total: {formatMoney(group.totalAmountCents)}</p>
                  <p>Invoiced: {formatMoney(group.invoicedAmountCents)}</p>
                  <p>Uninvoiced: {formatMoney(group.uninvoicedAmountCents)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="Shift register"
        copy="Each rider shift that overlaps the selected reporting window."
      >
        {loading || !shiftReport ? (
          <p className="text-sm text-[var(--surface-muted)]">Loading shifts...</p>
        ) : (
          <>
            <div className="table-shell desktop-only">
              <table className="editorial-table">
                <thead>
                  <tr>
                    <th>Rider</th>
                    <th>Check in</th>
                    <th>Check out</th>
                    <th>Status</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {shiftReport.shifts.map((shift) => (
                    <tr key={shift.id}>
                      <td className="text-[var(--surface-muted)]">{shift.riderName ?? 'Unknown rider'}</td>
                      <td className="text-[var(--surface-muted)]">{formatDateTime(shift.checkInAt)}</td>
                      <td className="text-[var(--surface-muted)]">{formatDateTime(shift.checkOutAt)}</td>
                      <td className="text-[var(--surface-muted)]">{shift.status}</td>
                      <td className="text-[var(--surface-muted)]">{formatValue(shift.note, 'No note')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mobile-record-list mobile-only">
              {shiftReport.shifts.map((shift) => (
                <div key={shift.id} className="mobile-record-card">
                  <div>
                    <p className="font-['Manrope'] text-sm font-extrabold text-[var(--primary)]">
                      {shift.riderName ?? 'Unknown rider'}
                    </p>
                    <p className="mt-1 text-sm text-[var(--surface-muted)]">{shift.status}</p>
                  </div>
                  <div className="mobile-record-row">
                    <div className="data-card">
                      <p className="data-label">Check in</p>
                      <p className="data-value">{formatDateTime(shift.checkInAt)}</p>
                    </div>
                    <div className="data-card">
                      <p className="data-label">Check out</p>
                      <p className="data-value">{formatDateTime(shift.checkOutAt)}</p>
                    </div>
                    <div className="data-card">
                      <p className="data-label">Note</p>
                      <p className="data-value">{formatValue(shift.note, 'No note')}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Panel>

      <Panel
        title="Shift handovers"
        copy="Outgoing and incoming rider confirmations captured during shift changes."
      >
        {loading || !shiftReport ? (
          <p className="text-sm text-[var(--surface-muted)]">Loading shift handovers...</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {shiftReport.handovers.map((handover) => (
              <div key={handover.id} className="data-card">
                <p className="data-label">
                  {handover.outgoingRiderName ?? 'Unknown rider'} to {handover.incomingRiderName ?? 'Unknown rider'}
                </p>
                <p className="data-value !mt-2">{handover.status}</p>
                <div className="mt-4 space-y-2 text-sm text-[var(--surface-muted)]">
                  <p>Started: {formatDateTime(handover.initiatedAt)}</p>
                  <p>Completed: {formatDateTime(handover.completedAt)}</p>
                  <p>{formatValue(handover.note, 'No handover note')}</p>
                </div>
              </div>
            ))}
            {shiftReport.handovers.length === 0 ? (
              <p className="text-sm text-[var(--surface-muted)]">
                No shift handovers were recorded in the selected window.
              </p>
            ) : null}
          </div>
        )}
      </Panel>

      <Panel
        title="Shift timeline"
        copy="A linear event trail of shift starts, endings, and confirmed rider replacements."
        actions={
          shiftReport ? (
            <button type="button" className="btn-secondary" onClick={exportShiftTimeline}>
              Export CSV
            </button>
          ) : null
        }
      >
        {loading || !shiftReport ? (
          <p className="text-sm text-[var(--surface-muted)]">Loading shift timeline...</p>
        ) : (
          <div className="space-y-3">
            {shiftReport.timeline.map((item) => (
              <div key={item.id} className="status-log">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-medium text-[var(--primary)]">
                    {item.riderName ?? 'Unknown rider'}: {item.title}
                  </p>
                  <p className="text-xs text-[var(--surface-muted)]">
                    {formatDateTime(item.timestamp)}
                  </p>
                </div>
                <p className="mt-2 text-sm text-[var(--surface-muted)]">{item.detail}</p>
              </div>
            ))}
            {shiftReport.timeline.length === 0 ? (
              <p className="text-sm text-[var(--surface-muted)]">
                No shift events were recorded in the selected window.
              </p>
            ) : null}
          </div>
        )}
      </Panel>

      <Panel
        title="Billable deliveries"
        copy="Every completed billable waybill in the selected period, including invoice linkage where present."
      >
        {loading || !billingReport ? (
          <p className="text-sm text-[var(--surface-muted)]">Loading billable deliveries...</p>
        ) : (
          <div className="table-shell">
            <table className="editorial-table">
              <thead>
                <tr>
                  <th>Waybill</th>
                  <th>Client</th>
                  <th>Completed</th>
                  <th>Amount</th>
                  <th>Invoice</th>
                </tr>
              </thead>
              <tbody>
                {billingReport.items.map((item) => (
                  <tr key={item.waybillId}>
                    <td>
                      <p className="font-['Manrope'] font-extrabold text-[var(--primary)]">
                        {item.waybillNumber}
                      </p>
                      <p className="mt-1 text-[var(--surface-muted)]">{item.orderReference}</p>
                    </td>
                    <td className="text-[var(--surface-muted)]">{item.clientName ?? 'Not assigned'}</td>
                    <td className="text-[var(--surface-muted)]">{formatDate(item.completionTime)}</td>
                    <td className="text-[var(--surface-muted)]">
                      <p>{formatMoney(item.deliveryChargeCents)}</p>
                      <p>{item.pricingTier}</p>
                    </td>
                    <td className="text-[var(--surface-muted)]">
                      {item.invoiceNumber ?? 'Not invoiced'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </ProtectedScreen>
  )
}
