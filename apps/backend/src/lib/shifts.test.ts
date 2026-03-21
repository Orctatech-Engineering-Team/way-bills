import { describe, expect, test } from 'bun:test'
import { buildShiftTimeline, computeShiftReportTotals } from './shifts'

describe('shift reporting helpers', () => {
  test('buildShiftTimeline orders shift and handover events newest first', () => {
    const timeline = buildShiftTimeline(
      [
        {
          id: 'shift-1',
          riderId: 'rider-a',
          riderName: 'Rider A',
          status: 'completed',
          note: 'Morning route',
          checkInAt: '2026-03-20T08:00:00.000Z',
          checkOutAt: '2026-03-20T12:00:00.000Z',
          createdAt: '2026-03-20T08:00:00.000Z',
        },
      ],
      [
        {
          id: 'handover-1',
          outgoingShiftId: 'shift-1',
          outgoingRiderId: 'rider-a',
          outgoingRiderName: 'Rider A',
          incomingRiderId: 'rider-b',
          incomingRiderName: 'Rider B',
          initiatedBy: 'Rider A',
          completedBy: 'Rider B',
          status: 'completed',
          note: 'Afternoon replacement',
          initiatedAt: '2026-03-20T11:30:00.000Z',
          outgoingConfirmedAt: '2026-03-20T11:30:00.000Z',
          incomingConfirmedAt: '2026-03-20T12:00:00.000Z',
          completedAt: '2026-03-20T12:00:00.000Z',
        },
      ],
    )

    expect(timeline.map((item) => item.type)).toEqual([
      'check_out',
      'handover_completed',
      'handover_started',
      'check_in',
    ])
  })

  test('computeShiftReportTotals counts active shifts, check-outs, and completed handovers', () => {
    const totals = computeShiftReportTotals(
      [
        {
          id: 'shift-1',
          riderId: 'rider-a',
          riderName: 'Rider A',
          status: 'active',
          note: null,
          checkInAt: '2026-03-20T08:00:00.000Z',
          checkOutAt: null,
          createdAt: '2026-03-20T08:00:00.000Z',
        },
        {
          id: 'shift-2',
          riderId: 'rider-b',
          riderName: 'Rider B',
          status: 'completed',
          note: null,
          checkInAt: '2026-03-20T07:00:00.000Z',
          checkOutAt: '2026-03-20T14:00:00.000Z',
          createdAt: '2026-03-20T07:00:00.000Z',
        },
      ],
      [
        {
          id: 'handover-1',
          outgoingShiftId: 'shift-2',
          outgoingRiderId: 'rider-b',
          outgoingRiderName: 'Rider B',
          incomingRiderId: 'rider-c',
          incomingRiderName: 'Rider C',
          initiatedBy: 'Rider B',
          completedBy: 'Rider C',
          status: 'completed',
          note: null,
          initiatedAt: '2026-03-20T13:30:00.000Z',
          outgoingConfirmedAt: '2026-03-20T13:30:00.000Z',
          incomingConfirmedAt: '2026-03-20T14:00:00.000Z',
          completedAt: '2026-03-20T14:00:00.000Z',
        },
        {
          id: 'handover-2',
          outgoingShiftId: 'shift-1',
          outgoingRiderId: 'rider-a',
          outgoingRiderName: 'Rider A',
          incomingRiderId: 'rider-d',
          incomingRiderName: 'Rider D',
          initiatedBy: 'Rider A',
          completedBy: null,
          status: 'pending',
          note: null,
          initiatedAt: '2026-03-20T15:00:00.000Z',
          outgoingConfirmedAt: '2026-03-20T15:00:00.000Z',
          incomingConfirmedAt: null,
          completedAt: null,
        },
      ],
    )

    expect(totals).toEqual({
      activeShifts: 1,
      shiftCheckIns: 2,
      shiftCheckOuts: 1,
      completedHandovers: 1,
    })
  })
})
