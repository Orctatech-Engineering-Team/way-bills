import { AppError } from './errors'
import type { WaybillStatus } from '../db/schema'

const transitions: Record<WaybillStatus, WaybillStatus[]> = {
  created: ['assigned', 'cancelled'],
  assigned: ['dispatched', 'failed', 'cancelled'],
  dispatched: ['delivered', 'failed'],
  delivered: [],
  failed: [],
  cancelled: [],
}

export function canTransition(
  fromStatus: WaybillStatus,
  toStatus: WaybillStatus,
) {
  return transitions[fromStatus].includes(toStatus)
}

export function assertTransition(
  fromStatus: WaybillStatus,
  toStatus: WaybillStatus,
) {
  if (!canTransition(fromStatus, toStatus)) {
    throw new AppError(
      400,
      'invalid_status_transition',
      `Cannot move a waybill from ${fromStatus} to ${toStatus}.`,
    )
  }
}

export function generateWaybillNumber(date = new Date(), sequence?: number) {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  const suffix =
    sequence ??
    Math.floor(Math.random() * 9000)
      .toString()
      .padStart(4, '0')

  return `WB-${y}${m}${d}-${suffix}`
}
