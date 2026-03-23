import { and, asc, eq, inArray } from 'drizzle-orm'
import { db } from '../db/client'
import { invoices } from '../db/schema'
import { AppError, assert } from './errors'
import { getInvoiceDetail, serializeInvoiceDetail, toInvoicePdfDetail } from './invoices'
import { sendInvoiceEmailMessage, buildInvoiceEmailContent } from './mailer'
import { createRoleNotifications } from './notifications'
import { buildInvoicePdf } from './pdf'

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value))
}

function formatMoneyLabel(cents: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100)
}

export async function sendInvoiceEmail(invoiceId: string) {
  const detail = await getInvoiceDetail(invoiceId)

  assert(detail.status !== 'void', new AppError(409, 'invoice_void', 'Voided invoices cannot be emailed.'))
  assert(
    detail.client.contactEmail,
    new AppError(409, 'missing_client_email', 'This client does not have a billing email address yet.'),
  )

  await db
    .update(invoices)
    .set({
      emailStatus: 'queued',
      emailDeliveryAttempts: detail.emailDeliveryAttempts + 1,
      lastEmailError: null,
    })
    .where(eq(invoices.id, detail.id))

  try {
    const pdfBytes = await buildInvoicePdf(toInvoicePdfDetail(detail))
    const content = buildInvoiceEmailContent({
      invoiceNumber: detail.invoiceNumber,
      clientName: detail.client.name,
      contactName: detail.client.contactName,
      recipientEmail: detail.client.contactEmail,
      periodStart: formatDateLabel(detail.periodStart.toISOString()),
      periodEnd: formatDateLabel(detail.periodEnd.toISOString()),
      subtotalLabel: formatMoneyLabel(detail.subtotalCents, detail.currency),
      dueAt: formatDateLabel(detail.dueAt.toISOString()),
      attachmentBytes: pdfBytes,
    })

    await sendInvoiceEmailMessage(content)

    await db
      .update(invoices)
      .set({
        emailStatus: 'sent',
        emailSentAt: new Date(),
        lastEmailError: null,
      })
      .where(eq(invoices.id, detail.id))
  } catch (error) {
    await db
      .update(invoices)
      .set({
        emailStatus: 'failed',
        lastEmailError: error instanceof Error ? error.message : 'Unknown email delivery failure.',
      })
      .where(eq(invoices.id, detail.id))

    await createRoleNotifications(['admin', 'ops'], {
      type: 'invoice_email_failed',
      title: 'Invoice email failed',
      message: `Email delivery failed for ${detail.invoiceNumber}.`,
      linkPath: '/ops/invoices',
      eventKey: `invoice_email_failed:${detail.id}`,
    })

    throw error
  }

  return {
    invoice: serializeInvoiceDetail(await getInvoiceDetail(invoiceId)),
  }
}

export async function deliverPendingAutomaticInvoiceEmails() {
  const pending = await db.query.invoices.findMany({
    where: and(
      eq(invoices.source, 'automatic'),
      eq(invoices.status, 'issued'),
      inArray(invoices.emailStatus, ['not_sent', 'failed']),
    ),
    orderBy: asc(invoices.issuedAt),
  })

  let sentCount = 0
  let failedCount = 0

  for (const invoice of pending) {
    try {
      await sendInvoiceEmail(invoice.id)
      sentCount += 1
    } catch {
      failedCount += 1
    }
  }

  return {
    scanned: pending.length,
    sentCount,
    failedCount,
  }
}
