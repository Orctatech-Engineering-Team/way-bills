import { config } from './config'
import {
  markInvoiceAutomationDisabled,
  markInvoiceAutomationFailed,
  markInvoiceAutomationStarted,
  markInvoiceAutomationSucceeded,
} from './lib/automation-status'
import { deliverPendingAutomaticInvoiceEmails } from './lib/invoice-email'
import { runInvoiceAutomationSweep } from './lib/invoice-automation'

let running = false

async function tick() {
  if (running) {
    console.warn('[worker] invoice automation tick skipped because the previous run is still active')
    return
  }

  running = true

  try {
    const startedAt = new Date()
    await markInvoiceAutomationStarted(startedAt)
    const summary = await runInvoiceAutomationSweep()
    const emailSummary = await deliverPendingAutomaticInvoiceEmails()
    const finishedAt = new Date()

    await markInvoiceAutomationSucceeded({
      finishedAt,
      invoiceSummary: `scanned=${summary.scannedWindows} created=${summary.createdCount} reused=${summary.reusedCount}`,
      emailSummary: `scanned=${emailSummary.scanned} sent=${emailSummary.sentCount} failed=${emailSummary.failedCount}`,
      emailFailureMessage:
        emailSummary.failedCount > 0
          ? `${emailSummary.failedCount} invoice email(s) failed in the last sweep.`
          : null,
    })

    console.log(
      `[worker] invoice automation sweep complete: scanned=${summary.scannedWindows} created=${summary.createdCount} reused=${summary.reusedCount} emailed=${emailSummary.sentCount} email_failed=${emailSummary.failedCount} lookback_weeks=${summary.lookbackWeeks}`,
    )
  } catch (error) {
    await markInvoiceAutomationFailed(error)
    console.error('[worker] invoice automation sweep failed', error)
  } finally {
    running = false
  }
}

if (import.meta.main) {
  if (!config.invoiceAutomationEnabled) {
    await markInvoiceAutomationDisabled()
    console.log('[worker] invoice automation is disabled')
  } else {
    const intervalMs = Math.max(1, config.invoiceAutomationIntervalMinutes) * 60_000

    console.log(
      `[worker] invoice automation enabled; interval=${config.invoiceAutomationIntervalMinutes}m lookback_weeks=${config.invoiceAutomationLookbackWeeks}`,
    )

    await tick()
    setInterval(() => {
      void tick()
    }, intervalMs)
  }
}
