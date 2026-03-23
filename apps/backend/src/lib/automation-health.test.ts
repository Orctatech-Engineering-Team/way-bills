import { describe, expect, test } from 'bun:test'
import { evaluateInvoiceAutomationHealth } from './automation-health'

describe('invoice automation health', () => {
  test('treats disabled automation as healthy', () => {
    expect(
      evaluateInvoiceAutomationHealth({
        enabled: false,
        running: false,
        intervalMinutes: 15,
        lastRunStartedAt: null,
        lastRunFinishedAt: null,
        lastSuccessAt: null,
        lastFailureAt: null,
        lastError: null,
      }),
    ).toEqual({
      healthy: true,
      reason: 'Invoice automation is disabled.',
    })
  })

  test('treats active runs as healthy', () => {
    expect(
      evaluateInvoiceAutomationHealth({
        enabled: true,
        running: true,
        intervalMinutes: 15,
        lastRunStartedAt: '2026-03-22T12:00:00.000Z',
        lastRunFinishedAt: null,
        lastSuccessAt: '2026-03-22T11:40:00.000Z',
        lastFailureAt: null,
        lastError: null,
      }),
    ).toEqual({
      healthy: true,
      reason: 'Invoice automation is currently running.',
    })
  })

  test('marks recent failures as unhealthy', () => {
    const result = evaluateInvoiceAutomationHealth(
      {
        enabled: true,
        running: false,
        intervalMinutes: 15,
        lastRunStartedAt: '2026-03-22T12:00:00.000Z',
        lastRunFinishedAt: '2026-03-22T12:02:00.000Z',
        lastSuccessAt: '2026-03-22T11:40:00.000Z',
        lastFailureAt: '2026-03-22T12:02:00.000Z',
        lastError: 'SMTP authentication failed.',
      },
      new Date('2026-03-22T12:05:00.000Z'),
    )

    expect(result).toEqual({
      healthy: false,
      reason: 'SMTP authentication failed.',
    })
  })

  test('marks stale workers as unhealthy', () => {
    const result = evaluateInvoiceAutomationHealth(
      {
        enabled: true,
        running: false,
        intervalMinutes: 10,
        lastRunStartedAt: '2026-03-22T09:00:00.000Z',
        lastRunFinishedAt: '2026-03-22T09:01:00.000Z',
        lastSuccessAt: '2026-03-22T09:01:00.000Z',
        lastFailureAt: null,
        lastError: null,
      },
      new Date('2026-03-22T10:00:00.000Z'),
    )

    expect(result.healthy).toBe(false)
    expect(result.reason).toContain('stale')
  })
})
