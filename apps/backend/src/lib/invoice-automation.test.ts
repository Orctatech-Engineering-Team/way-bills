import { describe, expect, test } from 'bun:test'
import { buildPendingInvoiceWindows } from './invoice-automation'

describe('invoice automation windows', () => {
  test('groups uninvoiced deliveries by client and completed billing week', () => {
    const windows = buildPendingInvoiceWindows(
      [
        {
          clientId: 'client-1',
          completionTime: new Date('2026-03-16T10:00:00.000Z'),
        },
        {
          clientId: 'client-1',
          completionTime: new Date('2026-03-18T14:00:00.000Z'),
        },
        {
          clientId: 'client-2',
          completionTime: new Date('2026-03-19T09:30:00.000Z'),
        },
      ],
      {
        now: new Date('2026-03-23T08:00:00.000Z'),
        lookbackWeeks: 8,
      },
    )

    expect(
      windows.map((window) => ({
        clientId: window.clientId,
        periodStart: window.periodStart.toISOString(),
        periodEnd: window.periodEnd.toISOString(),
        deliveredCount: window.deliveredCount,
      })),
    ).toEqual([
      {
        clientId: 'client-1',
        periodStart: '2026-03-16T00:00:00.000Z',
        periodEnd: '2026-03-22T23:59:59.999Z',
        deliveredCount: 2,
      },
      {
        clientId: 'client-2',
        periodStart: '2026-03-16T00:00:00.000Z',
        periodEnd: '2026-03-22T23:59:59.999Z',
        deliveredCount: 1,
      },
    ])
  })

  test('ignores current-week and out-of-lookback deliveries', () => {
    const windows = buildPendingInvoiceWindows(
      [
        {
          clientId: 'client-1',
          completionTime: new Date('2026-03-23T09:00:00.000Z'),
        },
        {
          clientId: 'client-1',
          completionTime: new Date('2026-01-01T09:00:00.000Z'),
        },
      ],
      {
        now: new Date('2026-03-23T08:00:00.000Z'),
        lookbackWeeks: 4,
      },
    )

    expect(windows).toHaveLength(0)
  })
})
