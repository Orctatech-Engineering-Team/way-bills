import { PDF, StandardFonts, rgb } from '@libpdf/core'
import type {
  InvoicePdfDetail,
  ProofOfDelivery,
  StatusLogEntry,
  WaybillDetail,
} from './pdf.types'

type PdfContext = {
  pdf: PDF
  page: ReturnType<PDF['addPage']>
  cursorY: number
}

const PAGE_MARGIN = 48
const PAGE_WIDTH = 612
const PAGE_HEIGHT = 792
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2

function createDocument(title: string) {
  const pdf = PDF.create()
  pdf.setTitle(title)
  pdf.setAuthor('Waybill System')
  pdf.setCreator('Waybill System')
  pdf.setProducer('@libpdf/core')
  pdf.setCreationDate(new Date())
  pdf.setModificationDate(new Date())

  const page = pdf.addPage({ size: 'letter' })

  return {
    pdf,
    page,
    cursorY: PAGE_HEIGHT - PAGE_MARGIN,
  } satisfies PdfContext
}

function nextPage(context: PdfContext) {
  context.page = context.pdf.addPage({ size: 'letter' })
  context.cursorY = PAGE_HEIGHT - PAGE_MARGIN
}

function ensureSpace(context: PdfContext, height: number) {
  if (context.cursorY - height < PAGE_MARGIN) {
    nextPage(context)
  }
}

function estimateLines(text: string, maxChars = 70) {
  return text
    .split('\n')
    .reduce((total, part) => total + Math.max(1, Math.ceil(part.length / maxChars)), 0)
}

function drawHeading(context: PdfContext, title: string, subtitle?: string) {
  context.page.drawText(title, {
    x: PAGE_MARGIN,
    y: context.cursorY,
    font: StandardFonts.HelveticaBold,
    size: 20,
    color: rgb(0.07, 0.1, 0.16),
  })
  context.cursorY -= 24

  if (subtitle) {
    context.page.drawText(subtitle, {
      x: PAGE_MARGIN,
      y: context.cursorY,
      font: StandardFonts.Helvetica,
      size: 10,
      color: rgb(0.4, 0.45, 0.55),
      maxWidth: CONTENT_WIDTH,
      lineHeight: 12,
    })
    context.cursorY -= estimateLines(subtitle, 90) * 12 + 8
  }

  context.page.drawLine({
    start: { x: PAGE_MARGIN, y: context.cursorY },
    end: { x: PAGE_WIDTH - PAGE_MARGIN, y: context.cursorY },
    color: rgb(0.86, 0.88, 0.91),
    thickness: 1,
  })
  context.cursorY -= 20
}

function drawMetaGrid(
  context: PdfContext,
  items: Array<[label: string, value: string]>,
  columns = 2,
) {
  const columnWidth = (CONTENT_WIDTH - (columns - 1) * 16) / columns
  const rowHeight = 56
  const rows = Math.ceil(items.length / columns)
  ensureSpace(context, rows * rowHeight + 12)

  for (let index = 0; index < items.length; index += 1) {
    const [label, value] = items[index]
    const col = index % columns
    const row = Math.floor(index / columns)
    const x = PAGE_MARGIN + col * (columnWidth + 16)
    const y = context.cursorY - row * rowHeight

    context.page.drawRectangle({
      x,
      y: y - 44,
      width: columnWidth,
      height: 44,
      color: rgb(0.97, 0.98, 0.99),
      borderColor: rgb(0.89, 0.91, 0.94),
      borderWidth: 1,
    })

    context.page.drawText(label, {
      x: x + 10,
      y: y - 14,
      font: StandardFonts.HelveticaBold,
      size: 8,
      color: rgb(0.42, 0.46, 0.52),
    })

    context.page.drawText(value, {
      x: x + 10,
      y: y - 30,
      font: StandardFonts.Helvetica,
      size: 10,
      color: rgb(0.07, 0.1, 0.16),
      maxWidth: columnWidth - 20,
      lineHeight: 12,
    })
  }

  context.cursorY -= rows * rowHeight + 6
}

function drawParagraph(
  context: PdfContext,
  label: string,
  value: string,
  maxChars = 85,
) {
  const lines = estimateLines(value, maxChars)
  const height = 28 + lines * 13
  ensureSpace(context, height)

  context.page.drawText(label, {
    x: PAGE_MARGIN,
    y: context.cursorY,
    font: StandardFonts.HelveticaBold,
    size: 9,
    color: rgb(0.42, 0.46, 0.52),
  })
  context.cursorY -= 14

  context.page.drawText(value, {
    x: PAGE_MARGIN,
    y: context.cursorY,
    font: StandardFonts.Helvetica,
    size: 11,
    color: rgb(0.07, 0.1, 0.16),
    maxWidth: CONTENT_WIDTH,
    lineHeight: 13,
  })
  context.cursorY -= lines * 13 + 12
}

function drawTimeline(context: PdfContext, logs: StatusLogEntry[]) {
  drawHeading(context, 'Status history')

  if (logs.length === 0) {
    drawParagraph(context, 'History', 'No status history recorded.')
    return
  }

  for (const log of logs) {
    ensureSpace(context, 72)
    context.page.drawRectangle({
      x: PAGE_MARGIN,
      y: context.cursorY - 56,
      width: CONTENT_WIDTH,
      height: 56,
      color: rgb(0.98, 0.99, 1),
      borderColor: rgb(0.89, 0.91, 0.94),
      borderWidth: 1,
    })
    context.page.drawText(`${log.fromStatus} to ${log.toStatus}`, {
      x: PAGE_MARGIN + 12,
      y: context.cursorY - 18,
      font: StandardFonts.HelveticaBold,
      size: 10,
      color: rgb(0.07, 0.1, 0.16),
    })
    context.page.drawText(log.changedAt, {
      x: PAGE_MARGIN + 12,
      y: context.cursorY - 34,
      font: StandardFonts.Helvetica,
      size: 9,
      color: rgb(0.42, 0.46, 0.52),
    })
    context.page.drawText(
      `${log.changedBy ?? 'Unknown'}${log.note ? ` • ${log.note}` : ''}`,
      {
        x: PAGE_MARGIN + 170,
        y: context.cursorY - 34,
        font: StandardFonts.Helvetica,
        size: 9,
        color: rgb(0.42, 0.46, 0.52),
        maxWidth: CONTENT_WIDTH - 182,
      },
    )
    context.cursorY -= 68
  }
}

function formatValue(value: string | null | undefined, fallback = 'Not set') {
  return value && value.trim() ? value : fallback
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100)
}

export async function buildWaybillPdf(waybill: WaybillDetail) {
  const context = createDocument(`Waybill ${waybill.waybillNumber}`)

  drawHeading(
    context,
    `Waybill ${waybill.waybillNumber}`,
    'Operational delivery document generated from the Waybill System source of truth.',
  )

  drawMetaGrid(context, [
    ['Status', waybill.status],
    ['Order reference', waybill.orderReference],
    ['Client', formatValue(waybill.client?.name)],
    ['Customer', formatValue(waybill.customerName)],
    ['Customer phone', waybill.customerPhone],
    ['Delivery method', waybill.deliveryMethod],
    ['Item value', formatValue(
      waybill.itemValueCents !== null
        ? formatMoney(waybill.itemValueCents, waybill.client?.currency ?? 'GHS')
        : null,
    )],
    ['Assigned rider', formatValue(waybill.assignedRider?.name)],
    ['Requested dispatch', formatValue(waybill.requestedDispatchTime)],
    ['Dispatch time', formatValue(waybill.dispatchTime)],
    ['Completion time', formatValue(waybill.completionTime)],
    ['Return time', formatValue(waybill.returnTime)],
  ])

  drawParagraph(context, 'Delivery address', waybill.deliveryAddress)

  if (waybill.notes) {
    drawParagraph(context, 'Notes', waybill.notes)
  }

  drawTimeline(context, waybill.statusLogs)

  return context.pdf.save()
}

export async function buildInvoicePdf(invoice: InvoicePdfDetail) {
  const context = createDocument(`Invoice ${invoice.invoiceNumber}`)

  drawHeading(
    context,
    `Invoice ${invoice.invoiceNumber}`,
    'Client billing document generated from delivered waybills in the Waybill System.',
  )

  drawMetaGrid(context, [
    ['Status', invoice.status],
    ['Client', invoice.client.name],
    ['Currency', invoice.currency],
    ['Issued at', invoice.issuedAt],
    ['Due at', invoice.dueAt],
    ['Billing period', `${invoice.periodStart} to ${invoice.periodEnd}`],
    ['Payment terms', `${invoice.client.paymentTermsDays} day(s)`],
    ['Subtotal', formatMoney(invoice.subtotalCents, invoice.currency)],
  ])

  drawParagraph(context, 'Billing address', invoice.client.billingAddress)

  if (invoice.notes) {
    drawParagraph(context, 'Notes', invoice.notes)
  }

  drawHeading(context, 'Invoice items')

  if (invoice.items.length === 0) {
    drawParagraph(context, 'Items', 'No billable waybills were attached to this invoice.')
    return context.pdf.save()
  }

  for (const item of invoice.items) {
    ensureSpace(context, 72)
    context.page.drawRectangle({
      x: PAGE_MARGIN,
      y: context.cursorY - 56,
      width: CONTENT_WIDTH,
      height: 56,
      color: rgb(0.98, 0.99, 1),
      borderColor: rgb(0.89, 0.91, 0.94),
      borderWidth: 1,
    })
    context.page.drawText(`${item.waybillNumber} • ${item.orderReference}`, {
      x: PAGE_MARGIN + 12,
      y: context.cursorY - 18,
      font: StandardFonts.HelveticaBold,
      size: 10,
      color: rgb(0.07, 0.1, 0.16),
    })
    context.page.drawText(
      `${formatValue(item.customerName)}${item.completionTime ? ` • ${item.completionTime}` : ''} • ${item.pricingTier}`,
      {
        x: PAGE_MARGIN + 12,
        y: context.cursorY - 34,
        font: StandardFonts.Helvetica,
        size: 9,
        color: rgb(0.42, 0.46, 0.52),
        maxWidth: CONTENT_WIDTH - 140,
      },
    )
    context.page.drawText(formatMoney(item.amountCents, invoice.currency), {
      x: PAGE_WIDTH - PAGE_MARGIN - 84,
      y: context.cursorY - 28,
      font: StandardFonts.HelveticaBold,
      size: 10,
      color: rgb(0.07, 0.1, 0.16),
    })
    context.cursorY -= 68
  }

  return context.pdf.save()
}

export async function buildPodPdf(options: {
  waybill: WaybillDetail
  pod: ProofOfDelivery
  signatureImageBytes?: Uint8Array | null
}) {
  const context = createDocument(`POD ${options.waybill.waybillNumber}`)
  const { waybill, pod, signatureImageBytes } = options

  drawHeading(
    context,
    `Proof of Delivery ${waybill.waybillNumber}`,
    'Delivery completion record generated from the Waybill System source of truth.',
  )

  drawMetaGrid(context, [
    ['Waybill number', waybill.waybillNumber],
    ['Order reference', waybill.orderReference],
    ['Customer', formatValue(waybill.customerName)],
    ['Recipient', formatValue(pod.recipientName)],
    ['Assigned rider', formatValue(waybill.assignedRider?.name)],
    ['Completed at', pod.completedAt],
  ])

  drawParagraph(context, 'Delivery address', waybill.deliveryAddress)

  if (pod.note) {
    drawParagraph(context, 'Review', pod.note)
  }

  if (signatureImageBytes) {
    ensureSpace(context, 220)
    drawHeading(context, 'Recipient signature')

    const image = context.pdf.embedPng(signatureImageBytes)
    const maxWidth = CONTENT_WIDTH
    const targetWidth = Math.min(280, image.width)
    const scale = targetWidth / image.width
    const targetHeight = image.height * scale

    ensureSpace(context, targetHeight + 24)
    context.page.drawRectangle({
      x: PAGE_MARGIN,
      y: context.cursorY - targetHeight - 18,
      width: maxWidth,
      height: targetHeight + 18,
      color: rgb(1, 1, 1),
      borderColor: rgb(0.89, 0.91, 0.94),
      borderWidth: 1,
    })
    context.page.drawImage(image, {
      x: PAGE_MARGIN + 12,
      y: context.cursorY - targetHeight - 6,
      width: targetWidth,
      height: targetHeight,
    })
    context.cursorY -= targetHeight + 30
  }

  return context.pdf.save()
}
