type SerializableAutomationStatus = {
  enabled: boolean
  running: boolean
  intervalMinutes: number
  lastRunStartedAt: string | null
  lastRunFinishedAt: string | null
  lastSuccessAt: string | null
  lastFailureAt: string | null
  lastError: string | null
}

function parseTime(value: string | null) {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function evaluateInvoiceAutomationHealth(
  status: SerializableAutomationStatus,
  now = new Date(),
) {
  if (!status.enabled) {
    return {
      healthy: true,
      reason: 'Invoice automation is disabled.',
    }
  }

  if (status.running) {
    return {
      healthy: true,
      reason: 'Invoice automation is currently running.',
    }
  }

  const staleMinutes = Math.max(status.intervalMinutes * 3, 30)
  const lastRunStartedAt = parseTime(status.lastRunStartedAt)
  const lastRunFinishedAt = parseTime(status.lastRunFinishedAt)
  const lastSuccessAt = parseTime(status.lastSuccessAt)
  const lastFailureAt = parseTime(status.lastFailureAt)
  const lastActivityAt = [lastRunFinishedAt, lastSuccessAt, lastFailureAt, lastRunStartedAt]
    .filter((value): value is Date => value instanceof Date)
    .sort((left, right) => right.getTime() - left.getTime())[0]

  if (!lastActivityAt) {
    return {
      healthy: false,
      reason: 'Invoice automation has not reported a run yet.',
    }
  }

  const minutesSinceActivity = (now.getTime() - lastActivityAt.getTime()) / 60_000
  if (minutesSinceActivity > staleMinutes) {
    return {
      healthy: false,
      reason: `Invoice automation is stale. Last activity was ${Math.floor(minutesSinceActivity)} minute(s) ago.`,
    }
  }

  if (
    lastFailureAt &&
    (!lastSuccessAt || lastFailureAt.getTime() >= lastSuccessAt.getTime())
  ) {
    return {
      healthy: false,
      reason: status.lastError || 'The most recent invoice automation run failed.',
    }
  }

  return {
    healthy: true,
    reason: 'Invoice automation is healthy.',
  }
}
