import { eq } from 'drizzle-orm'
import { config } from '../config'
import { db } from '../db/client'
import { automationJobStatuses } from '../db/schema'

const INVOICE_AUTOMATION_JOB = 'invoice_automation'

type InvoiceAutomationStatusUpdate = Partial<
  Omit<typeof automationJobStatuses.$inferInsert, 'jobName'>
>

function baseStatusRow() {
  return {
    jobName: INVOICE_AUTOMATION_JOB,
    enabled: config.invoiceAutomationEnabled,
    running: false,
    intervalMinutes: config.invoiceAutomationIntervalMinutes,
    lookbackWeeks: config.invoiceAutomationLookbackWeeks,
    lastRunStartedAt: null,
    lastRunFinishedAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastError: null,
    lastInvoiceSummary: null,
    lastEmailSummary: null,
    lastEmailFailureAt: null,
    lastEmailError: null,
    updatedAt: null,
  }
}

export function serializeInvoiceAutomationStatus(
  status: typeof automationJobStatuses.$inferSelect | null | undefined,
) {
  if (!status) {
    return baseStatusRow()
  }

  return {
    jobName: status.jobName,
    enabled: status.enabled,
    running: status.running,
    intervalMinutes: status.intervalMinutes,
    lookbackWeeks: status.lookbackWeeks,
    lastRunStartedAt: status.lastRunStartedAt?.toISOString() ?? null,
    lastRunFinishedAt: status.lastRunFinishedAt?.toISOString() ?? null,
    lastSuccessAt: status.lastSuccessAt?.toISOString() ?? null,
    lastFailureAt: status.lastFailureAt?.toISOString() ?? null,
    lastError: status.lastError,
    lastInvoiceSummary: status.lastInvoiceSummary,
    lastEmailSummary: status.lastEmailSummary,
    lastEmailFailureAt: status.lastEmailFailureAt?.toISOString() ?? null,
    lastEmailError: status.lastEmailError,
    updatedAt: status.updatedAt.toISOString(),
  }
}

async function upsertInvoiceAutomationStatus(update: InvoiceAutomationStatusUpdate) {
  const now = new Date()

  await db
    .insert(automationJobStatuses)
    .values({
      jobName: INVOICE_AUTOMATION_JOB,
      enabled: config.invoiceAutomationEnabled,
      running: false,
      intervalMinutes: config.invoiceAutomationIntervalMinutes,
      lookbackWeeks: config.invoiceAutomationLookbackWeeks,
      updatedAt: now,
      ...update,
    })
    .onConflictDoUpdate({
      target: automationJobStatuses.jobName,
      set: {
        enabled: update.enabled ?? config.invoiceAutomationEnabled,
        running: update.running ?? false,
        intervalMinutes:
          update.intervalMinutes ?? config.invoiceAutomationIntervalMinutes,
        lookbackWeeks:
          update.lookbackWeeks ?? config.invoiceAutomationLookbackWeeks,
        lastRunStartedAt: update.lastRunStartedAt,
        lastRunFinishedAt: update.lastRunFinishedAt,
        lastSuccessAt: update.lastSuccessAt,
        lastFailureAt: update.lastFailureAt,
        lastError: update.lastError,
        lastInvoiceSummary: update.lastInvoiceSummary,
        lastEmailSummary: update.lastEmailSummary,
        lastEmailFailureAt: update.lastEmailFailureAt,
        lastEmailError: update.lastEmailError,
        updatedAt: now,
      },
    })
}

export async function getInvoiceAutomationStatus() {
  const status = await db.query.automationJobStatuses.findFirst({
    where: eq(automationJobStatuses.jobName, INVOICE_AUTOMATION_JOB),
  })

  return serializeInvoiceAutomationStatus(status)
}

export async function markInvoiceAutomationDisabled() {
  await upsertInvoiceAutomationStatus({
    enabled: false,
    running: false,
    intervalMinutes: config.invoiceAutomationIntervalMinutes,
    lookbackWeeks: config.invoiceAutomationLookbackWeeks,
  })
}

export async function markInvoiceAutomationStarted(startedAt = new Date()) {
  await upsertInvoiceAutomationStatus({
    enabled: true,
    running: true,
    intervalMinutes: config.invoiceAutomationIntervalMinutes,
    lookbackWeeks: config.invoiceAutomationLookbackWeeks,
    lastRunStartedAt: startedAt,
    lastError: null,
  })
}

export async function markInvoiceAutomationSucceeded(input: {
  finishedAt?: Date
  invoiceSummary: string
  emailSummary: string
  emailFailureMessage?: string | null
}) {
  const finishedAt = input.finishedAt ?? new Date()

  await upsertInvoiceAutomationStatus({
    enabled: true,
    running: false,
    intervalMinutes: config.invoiceAutomationIntervalMinutes,
    lookbackWeeks: config.invoiceAutomationLookbackWeeks,
    lastRunFinishedAt: finishedAt,
    lastSuccessAt: finishedAt,
    lastError: null,
    lastInvoiceSummary: input.invoiceSummary,
    lastEmailSummary: input.emailSummary,
    lastEmailFailureAt: input.emailFailureMessage ? finishedAt : undefined,
    lastEmailError: input.emailFailureMessage ?? undefined,
  })
}

export async function markInvoiceAutomationFailed(error: unknown, finishedAt = new Date()) {
  await upsertInvoiceAutomationStatus({
    enabled: true,
    running: false,
    intervalMinutes: config.invoiceAutomationIntervalMinutes,
    lookbackWeeks: config.invoiceAutomationLookbackWeeks,
    lastRunFinishedAt: finishedAt,
    lastFailureAt: finishedAt,
    lastError:
      error instanceof Error ? error.message : 'Unknown invoice automation failure.',
  })
}
