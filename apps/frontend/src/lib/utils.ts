import type { UserRole, WaybillStatus } from './types'

export function defaultRouteForRole(role: UserRole) {
  if (role === 'rider') return '/rider/jobs'
  if (role === 'admin') return '/ops/waybills'
  return '/ops/waybills'
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Not set'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function formatDate(value: string | null | undefined) {
  if (!value) return 'Not set'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
  }).format(new Date(value))
}

export function statusLabel(status: WaybillStatus) {
  return status.replace('_', ' ')
}

export function dateInputValue(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function startOfBillingWeek(date: Date) {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const day = start.getDay()
  const offset = (day + 6) % 7
  start.setDate(start.getDate() - offset)
  return start
}

export function endOfBillingWeek(date: Date) {
  const end = startOfBillingWeek(date)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return end
}

export function shiftDateByDays(date: Date, amount: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

export function formatValue(value: string | null | undefined, fallback = 'Not set') {
  if (!value) {
    return fallback
  }

  return value
}

export function deliveryMethodLabel(value: string | null | undefined) {
  if (!value) {
    return 'Not set'
  }

  return value.replaceAll('_', ' ')
}

export function formatMoney(amountCents: number, currency = 'GHS') {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amountCents / 100)
}
