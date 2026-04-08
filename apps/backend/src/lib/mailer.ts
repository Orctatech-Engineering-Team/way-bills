import nodemailer from 'nodemailer'
import { assertMailConfig, config } from '../config'
import { AppError } from './errors'

export type InvoiceEmailContent = {
  to: string
  subject: string
  text: string
  html: string
  attachmentFilename: string
  attachmentBytes: Uint8Array
}

export function buildInvoiceEmailContent(input: {
  invoiceNumber: string
  clientName: string
  contactName: string | null
  recipientEmail: string
  periodStart: string
  periodEnd: string
  subtotalLabel: string
  dueAt: string
  attachmentBytes: Uint8Array
}) {
  const salutation = input.contactName ?? input.clientName

  return {
    to: input.recipientEmail,
    subject: `Invoice ${input.invoiceNumber}`,
    text: [
      `Hello ${salutation},`,
      '',
      `Attached is invoice ${input.invoiceNumber} for deliveries completed between ${input.periodStart} and ${input.periodEnd}.`,
      `Total due: ${input.subtotalLabel}`,
      `Payment due by: ${input.dueAt}`,
      '',
      'Please contact operations if anything needs review.',
    ].join('\n'),
    html: [
      `<p>Hello ${salutation},</p>`,
      `<p>Attached is invoice <strong>${input.invoiceNumber}</strong> for deliveries completed between <strong>${input.periodStart}</strong> and <strong>${input.periodEnd}</strong>.</p>`,
      `<p>Total due: <strong>${input.subtotalLabel}</strong><br/>Payment due by: <strong>${input.dueAt}</strong></p>`,
      '<p>Please contact operations if anything needs review.</p>',
    ].join(''),
    attachmentFilename: `${input.invoiceNumber}.pdf`,
    attachmentBytes: input.attachmentBytes,
  }
}

let transport: nodemailer.Transporter | null = null

function getTransport() {
  if (transport) {
    return transport
  }

  assertMailConfig()
  transport = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPassword,
    },
  })

  return transport
}

export async function sendInvoiceEmailMessage(content: InvoiceEmailContent) {
  try {
    const mailer = getTransport()

    await mailer.sendMail({
      from: config.mailFrom,
      to: content.to,
      replyTo: config.mailReplyTo || undefined,
      subject: content.subject,
      text: content.text,
      html: content.html,
      attachments: [
        {
          filename: content.attachmentFilename,
          content: Buffer.from(content.attachmentBytes),
          contentType: 'application/pdf',
        },
      ],
    })
  } catch (error) {
    throw new AppError(
      502,
      'email_delivery_failed',
      'Unable to send the invoice email.',
      error instanceof Error ? error.message : error,
    )
  }
}
