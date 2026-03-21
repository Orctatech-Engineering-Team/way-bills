export type ShiftReportShift = {
  id: string
  riderId: string
  riderName: string | null
  status: 'active' | 'completed'
  note: string | null
  checkInAt: string
  checkOutAt: string | null
  createdAt: string
}

export type ShiftReportHandover = {
  id: string
  outgoingShiftId: string
  outgoingRiderId: string
  outgoingRiderName: string | null
  incomingRiderId: string
  incomingRiderName: string | null
  initiatedBy: string | null
  completedBy: string | null
  status: 'pending' | 'completed' | 'cancelled'
  note: string | null
  initiatedAt: string
  outgoingConfirmedAt: string
  incomingConfirmedAt: string | null
  completedAt: string | null
}

export type ShiftTimelineEvent = {
  id: string
  type: 'check_in' | 'check_out' | 'handover_started' | 'handover_completed'
  timestamp: string
  riderId: string
  riderName: string | null
  title: string
  detail: string
}

export function buildShiftTimeline(
  shifts: ShiftReportShift[],
  handovers: ShiftReportHandover[],
) {
  return [
    ...shifts.flatMap<ShiftTimelineEvent>((shift) => {
      const items: ShiftTimelineEvent[] = [
        {
          id: `${shift.id}:check-in`,
          type: 'check_in',
          timestamp: shift.checkInAt,
          riderId: shift.riderId,
          riderName: shift.riderName,
          title: 'Shift checked in',
          detail: shift.note ?? 'Shift started.',
        },
      ]

      if (shift.checkOutAt) {
        items.push({
          id: `${shift.id}:check-out`,
          type: 'check_out',
          timestamp: shift.checkOutAt,
          riderId: shift.riderId,
          riderName: shift.riderName,
          title: 'Shift checked out',
          detail: 'Shift ended.',
        })
      }

      return items
    }),
    ...handovers.flatMap<ShiftTimelineEvent>((handover) => {
      const items: ShiftTimelineEvent[] = [
        {
          id: `${handover.id}:handover-started`,
          type: 'handover_started',
          timestamp: handover.initiatedAt,
          riderId: handover.outgoingRiderId,
          riderName: handover.outgoingRiderName,
          title: `Handover started to ${handover.incomingRiderName ?? 'next rider'}`,
          detail: handover.note ?? 'Outgoing rider confirmed handover.',
        },
      ]

      if (handover.completedAt) {
        items.push({
          id: `${handover.id}:handover-completed`,
          type: 'handover_completed',
          timestamp: handover.completedAt,
          riderId: handover.incomingRiderId,
          riderName: handover.incomingRiderName,
          title: `Handover completed from ${handover.outgoingRiderName ?? 'previous rider'}`,
          detail: 'Both riders confirmed the shift change.',
        })
      }

      return items
    }),
  ].sort((left, right) => right.timestamp.localeCompare(left.timestamp))
}

export function computeShiftReportTotals(
  shifts: ShiftReportShift[],
  handovers: ShiftReportHandover[],
) {
  return {
    activeShifts: shifts.filter((shift) => shift.status === 'active').length,
    shiftCheckIns: shifts.length,
    shiftCheckOuts: shifts.filter((shift) => Boolean(shift.checkOutAt)).length,
    completedHandovers: handovers.filter((handover) => handover.status === 'completed').length,
  }
}
