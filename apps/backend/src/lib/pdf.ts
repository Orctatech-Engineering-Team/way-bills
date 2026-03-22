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
  pageNumber: number
  documentLabel: string
}

const PAGE_MARGIN = 44
const PAGE_WIDTH = 612
const PAGE_HEIGHT = 792
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2

const COLORS = {
  ink: rgb(0.08, 0.1, 0.13),
  muted: rgb(0.36, 0.4, 0.46),
  line: rgb(0.83, 0.84, 0.8),
  softLine: rgb(0.9, 0.9, 0.87),
  paper: rgb(0.99, 0.985, 0.97),
  panel: rgb(0.965, 0.955, 0.93),
  panelDeep: rgb(0.93, 0.915, 0.88),
  navy: rgb(0.11, 0.21, 0.34),
  success: rgb(0.12, 0.29, 0.22),
} as const

function estimateLines(text: string, maxChars = 70) {
  return text
    .split('\n')
    .reduce((total, part) => total + Math.max(1, Math.ceil(part.length / maxChars)), 0)
}

function normaliseValue(value: string | null | undefined, fallback = 'Not recorded') {
  return value && value.trim() ? value : fallback
}

function moneyValue(cents: number | null, currency: string) {
  if (cents === null) {
    return 'Not recorded'
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100)
}

function decoratePage(context: PdfContext) {
  context.page.drawLine({
    start: { x: PAGE_MARGIN, y: PAGE_HEIGHT - 28 },
    end: { x: PAGE_WIDTH - PAGE_MARGIN, y: PAGE_HEIGHT - 28 },
    color: COLORS.line,
    thickness: 1,
  })
  context.page.drawLine({
    start: { x: PAGE_MARGIN, y: PAGE_MARGIN - 8 },
    end: { x: PAGE_WIDTH - PAGE_MARGIN, y: PAGE_MARGIN - 8 },
    color: COLORS.line,
    thickness: 1,
  })
  context.page.drawText(context.documentLabel, {
    x: PAGE_MARGIN,
    y: PAGE_HEIGHT - 22,
    font: StandardFonts.Courier,
    size: 8,
    color: COLORS.muted,
  })
  context.page.drawText(`Page ${context.pageNumber}`, {
    x: PAGE_WIDTH - PAGE_MARGIN - 44,
    y: PAGE_HEIGHT - 22,
    font: StandardFonts.Courier,
    size: 8,
    color: COLORS.muted,
  })
  context.page.drawText('Generated from Waybill System', {
    x: PAGE_MARGIN,
    y: PAGE_MARGIN - 2,
    font: StandardFonts.Courier,
    size: 8,
    color: COLORS.muted,
  })
}

function createDocument(title: string, documentLabel: string) {
  const pdf = PDF.create()
  pdf.setTitle(title)
  pdf.setAuthor('Waybill System')
  pdf.setCreator('Waybill System')
  pdf.setProducer('@libpdf/core')
  pdf.setCreationDate(new Date())
  pdf.setModificationDate(new Date())

  const page = pdf.addPage({ size: 'letter' })
  const context: PdfContext = {
    pdf,
    page,
    cursorY: PAGE_HEIGHT - PAGE_MARGIN - 10,
    pageNumber: 1,
    documentLabel,
  }
  decoratePage(context)
  return context
}

function nextPage(context: PdfContext) {
  context.page = context.pdf.addPage({ size: 'letter' })
  context.pageNumber += 1
  context.cursorY = PAGE_HEIGHT - PAGE_MARGIN - 10
  decoratePage(context)
}

function ensureSpace(context: PdfContext, height: number) {
  if (context.cursorY - height < PAGE_MARGIN + 20) {
    nextPage(context)
  }
}

function drawLabel(context: PdfContext, text: string, x: number, y: number) {
  context.page.drawText(text.toUpperCase(), {
    x,
    y,
    font: StandardFonts.CourierBold,
    size: 8,
    color: COLORS.muted,
  })
}

function drawDocumentHeader(context: PdfContext, options: {
  eyebrow: string
  title: string
  subtitle: string
  rightTopLabel: string
  rightTopValue: string
  rightBottomLabel: string
  rightBottomValue: string
}) {
  const cardWidth = 186
  const gap = 18
  const leftWidth = CONTENT_WIDTH - cardWidth - gap
  const cardX = PAGE_MARGIN + leftWidth + gap
  const topY = context.cursorY
  const subtitleLines = estimateLines(options.subtitle, 56)
  const cardHeight = 108
  const headerHeight = Math.max(110, 62 + subtitleLines * 13)

  ensureSpace(context, Math.max(headerHeight, cardHeight) + 12)

  drawLabel(context, options.eyebrow, PAGE_MARGIN, topY)
  context.page.drawText(options.title, {
    x: PAGE_MARGIN,
    y: topY - 22,
    font: StandardFonts.HelveticaBold,
    size: 24,
    color: COLORS.ink,
    maxWidth: leftWidth,
  })
  context.page.drawText(options.subtitle, {
    x: PAGE_MARGIN,
    y: topY - 46,
    font: StandardFonts.Helvetica,
    size: 10,
    color: COLORS.muted,
    maxWidth: leftWidth,
    lineHeight: 13,
  })

  context.page.drawRectangle({
    x: cardX,
    y: topY - cardHeight + 4,
    width: cardWidth,
    height: cardHeight,
    color: COLORS.panel,
    borderColor: COLORS.line,
    borderWidth: 1,
  })

  drawLabel(context, options.rightTopLabel, cardX + 12, topY - 16)
  context.page.drawText(options.rightTopValue, {
    x: cardX + 12,
    y: topY - 42,
    font: StandardFonts.HelveticaBold,
    size: 20,
    color: COLORS.ink,
    maxWidth: cardWidth - 24,
    lineHeight: 20,
  })

  context.page.drawLine({
    start: { x: cardX + 12, y: topY - 55 },
    end: { x: cardX + cardWidth - 12, y: topY - 55 },
    color: COLORS.line,
    thickness: 1,
  })

  drawLabel(context, options.rightBottomLabel, cardX + 12, topY - 72)
  context.page.drawText(options.rightBottomValue, {
    x: cardX + 12,
    y: topY - 94,
    font: StandardFonts.Helvetica,
    size: 11,
    color: COLORS.ink,
    maxWidth: cardWidth - 24,
  })

  context.cursorY = topY - Math.max(headerHeight, cardHeight) - 12
}

function drawSectionHeader(context: PdfContext, title: string, subtitle?: string) {
  const subtitleLines = subtitle ? estimateLines(subtitle, 88) : 0
  const height = 28 + subtitleLines * 12
  ensureSpace(context, height)

  drawLabel(context, title, PAGE_MARGIN, context.cursorY)
  if (subtitle) {
    context.page.drawText(subtitle, {
      x: PAGE_MARGIN,
      y: context.cursorY - 13,
      font: StandardFonts.Helvetica,
      size: 9,
      color: COLORS.muted,
      maxWidth: CONTENT_WIDTH,
      lineHeight: 12,
    })
  }

  context.page.drawLine({
    start: { x: PAGE_MARGIN, y: context.cursorY - 22 - subtitleLines * 12 },
    end: { x: PAGE_WIDTH - PAGE_MARGIN, y: context.cursorY - 22 - subtitleLines * 12 },
    color: COLORS.line,
    thickness: 1,
  })

  context.cursorY -= 32 + subtitleLines * 12
}

function drawFieldGrid(
  context: PdfContext,
  items: Array<[label: string, value: string]>,
  columns = 2,
) {
  const gap = 10
  const columnWidth = (CONTENT_WIDTH - gap * (columns - 1)) / columns
  const baseHeight = 54
  const rows = Math.ceil(items.length / columns)

  ensureSpace(context, rows * (baseHeight + gap))

  for (let index = 0; index < items.length; index += 1) {
    const [label, value] = items[index]
    const column = index % columns
    const row = Math.floor(index / columns)
    const x = PAGE_MARGIN + column * (columnWidth + gap)
    const y = context.cursorY - row * (baseHeight + gap)
    const valueLines = estimateLines(value, 24)
    const blockHeight = baseHeight + Math.max(0, valueLines - 1) * 10

    context.page.drawRectangle({
      x,
      y: y - blockHeight,
      width: columnWidth,
      height: blockHeight,
      color: COLORS.paper,
      borderColor: COLORS.softLine,
      borderWidth: 1,
    })
    drawLabel(context, label, x + 10, y - 14)
    context.page.drawText(value, {
      x: x + 10,
      y: y - 34,
      font: StandardFonts.Helvetica,
      size: 10,
      color: COLORS.ink,
      maxWidth: columnWidth - 20,
      lineHeight: 12,
    })
  }

  context.cursorY -= rows * (baseHeight + gap)
}

function drawTextBlock(
  context: PdfContext,
  label: string,
  value: string,
  minHeight = 64,
  maxChars = 90,
) {
  const lines = estimateLines(value, maxChars)
  const height = Math.max(minHeight, 28 + lines * 13)
  ensureSpace(context, height + 8)

  context.page.drawRectangle({
    x: PAGE_MARGIN,
    y: context.cursorY - height,
    width: CONTENT_WIDTH,
    height,
    color: COLORS.paper,
    borderColor: COLORS.softLine,
    borderWidth: 1,
  })
  drawLabel(context, label, PAGE_MARGIN + 12, context.cursorY - 14)
  context.page.drawText(value, {
    x: PAGE_MARGIN + 12,
    y: context.cursorY - 36,
    font: StandardFonts.Helvetica,
    size: 10,
    color: COLORS.ink,
    maxWidth: CONTENT_WIDTH - 24,
    lineHeight: 13,
  })

  context.cursorY -= height + 10
}

function drawRecordList(
  context: PdfContext,
  title: string,
  rows: Array<{
    title: string
    meta: string
    right: string
  }>,
  emptyMessage: string,
) {
  drawSectionHeader(context, title)

  if (rows.length === 0) {
    drawTextBlock(context, title, emptyMessage, 52)
    return
  }

  const rowHeight = 54
  for (const row of rows) {
    ensureSpace(context, rowHeight + 6)
    context.page.drawRectangle({
      x: PAGE_MARGIN,
      y: context.cursorY - rowHeight,
      width: CONTENT_WIDTH,
      height: rowHeight,
      color: COLORS.paper,
      borderColor: COLORS.softLine,
      borderWidth: 1,
    })
    context.page.drawText(row.title, {
      x: PAGE_MARGIN + 12,
      y: context.cursorY - 18,
      font: StandardFonts.HelveticaBold,
      size: 10,
      color: COLORS.ink,
      maxWidth: CONTENT_WIDTH - 170,
    })
    context.page.drawText(row.meta, {
      x: PAGE_MARGIN + 12,
      y: context.cursorY - 34,
      font: StandardFonts.Helvetica,
      size: 9,
      color: COLORS.muted,
      maxWidth: CONTENT_WIDTH - 170,
    })
    context.page.drawText(row.right, {
      x: PAGE_WIDTH - PAGE_MARGIN - 120,
      y: context.cursorY - 26,
      font: StandardFonts.Courier,
      size: 8,
      color: COLORS.navy,
      maxWidth: 108,
      lineHeight: 10,
    })
    context.cursorY -= rowHeight + 8
  }
}

function drawSignatureBlock(
  context: PdfContext,
  signatureImageBytes: Uint8Array | null | undefined,
) {
  drawSectionHeader(
    context,
    'Recipient signature',
    'Signature captured digitally at completion and stored with the delivery audit record.',
  )

  const frameHeight = signatureImageBytes ? 180 : 96
  ensureSpace(context, frameHeight + 8)
  context.page.drawRectangle({
    x: PAGE_MARGIN,
    y: context.cursorY - frameHeight,
    width: CONTENT_WIDTH,
    height: frameHeight,
    color: COLORS.paper,
    borderColor: COLORS.line,
    borderWidth: 1,
  })

  if (!signatureImageBytes) {
    context.page.drawText('Signature image was not available when this PDF was generated.', {
      x: PAGE_MARGIN + 14,
      y: context.cursorY - 34,
      font: StandardFonts.Helvetica,
      size: 10,
      color: COLORS.muted,
      maxWidth: CONTENT_WIDTH - 28,
    })
    context.cursorY -= frameHeight + 8
    return
  }

  const image = context.pdf.embedPng(signatureImageBytes)
  const maxWidth = CONTENT_WIDTH - 28
  const maxHeight = frameHeight - 28
  const ratio = Math.min(maxWidth / image.width, maxHeight / image.height)
  const targetWidth = image.width * ratio
  const targetHeight = image.height * ratio
  const x = PAGE_MARGIN + 14
  const y = context.cursorY - 14 - targetHeight - (maxHeight - targetHeight) / 2

  context.page.drawImage(image, {
    x,
    y,
    width: targetWidth,
    height: targetHeight,
  })

  context.cursorY -= frameHeight + 8
}

export async function buildWaybillPdf(waybill: WaybillDetail) {
  const currency = waybill.client?.currency ?? 'GHS'
  const context = createDocument(
    `Waybill ${waybill.waybillNumber}`,
    'WAYBILL / DELIVERY NOTE',
  )

  drawDocumentHeader(context, {
    eyebrow: 'Waybill system record',
    title: 'Waybill / Delivery Note',
    subtitle:
      'Operational dispatch form for rider handling, recipient delivery, and audit review. This PDF is generated directly from the current system record.',
    rightTopLabel: 'Waybill number',
    rightTopValue: waybill.waybillNumber,
    rightBottomLabel: 'Current status',
    rightBottomValue: waybill.status.toUpperCase(),
  })

  drawSectionHeader(
    context,
    'Reference and client',
    'Primary document references and the business account this delivery belongs to.',
  )
  drawFieldGrid(context, [
    ['Order reference', normaliseValue(waybill.orderReference)],
    ['Client account', normaliseValue(waybill.client?.name)],
    ['Client contact', normaliseValue(waybill.client?.contactName)],
    ['Client phone', normaliseValue(waybill.client?.contactPhone)],
    ['Issued at', normaliseValue(waybill.createdAt)],
    ['Delivery method', normaliseValue(waybill.deliveryMethod)],
  ])

  drawSectionHeader(
    context,
    'Consignment details',
    'Core recipient, contact, and destination information used during dispatch and handover.',
  )
  drawFieldGrid(context, [
    ['Recipient / customer', normaliseValue(waybill.customerName)],
    ['Contact phone', normaliseValue(waybill.customerPhone)],
    ['Declared item value', moneyValue(waybill.itemValueCents, currency)],
    ['Assigned rider', normaliseValue(waybill.assignedRider?.name)],
  ])
  drawTextBlock(context, 'Delivery location', normaliseValue(waybill.deliveryAddress))

  if (waybill.notes) {
    drawTextBlock(
      context,
      'Delivery instructions / notes',
      normaliseValue(waybill.notes),
      70,
    )
  }

  drawSectionHeader(
    context,
    'Dispatch and completion control',
    'Key operational timestamps used for live handling, delivery confirmation, and returns.',
  )
  drawFieldGrid(context, [
    ['Requested dispatch', normaliseValue(waybill.requestedDispatchTime)],
    ['Dispatch time', normaliseValue(waybill.dispatchTime)],
    ['Delivery time', normaliseValue(waybill.completionTime)],
    ['Return time', normaliseValue(waybill.returnTime)],
  ])

  drawRecordList(
    context,
    'Rider handover trail',
    waybill.handovers.map((handover) => ({
      title: `${normaliseValue(handover.fromRiderName, 'Unassigned')} to ${normaliseValue(handover.toRiderName)}`,
      meta: normaliseValue(handover.note, 'No handover note recorded.'),
      right: handover.handedOverAt,
    })),
    'No rider handovers were recorded for this waybill.',
  )

  drawRecordList(
    context,
    'Status timeline',
    waybill.statusLogs.map((log) => ({
      title: `${log.fromStatus} to ${log.toStatus}`,
      meta: `${normaliseValue(log.changedBy, 'Unknown user')}${log.note ? ` | ${log.note}` : ''}`,
      right: log.changedAt,
    })),
    'No status history has been recorded for this waybill.',
  )

  return context.pdf.save()
}

export async function buildInvoicePdf(invoice: InvoicePdfDetail) {
  const context = createDocument(`Invoice ${invoice.invoiceNumber}`, 'CLIENT INVOICE')

  drawDocumentHeader(context, {
    eyebrow: 'Billing document',
    title: 'Weekly client invoice',
    subtitle:
      'Charge summary generated from completed deliveries within the selected billing window.',
    rightTopLabel: 'Invoice number',
    rightTopValue: invoice.invoiceNumber,
    rightBottomLabel: 'Invoice status',
    rightBottomValue: invoice.status.toUpperCase(),
  })

  drawSectionHeader(
    context,
    'Client and billing period',
    'Commercial account information, billing window, and the payment frame attached to this invoice.',
  )
  drawFieldGrid(context, [
    ['Client account', invoice.client.name],
    ['Currency', invoice.currency],
    ['Issued at', invoice.issuedAt],
    ['Due at', invoice.dueAt],
    ['Billing period', `${invoice.periodStart} to ${invoice.periodEnd}`],
    ['Payment terms', `${invoice.client.paymentTermsDays} day(s)`],
    ['Subtotal', moneyValue(invoice.subtotalCents, invoice.currency)],
    ['Client contact', normaliseValue(invoice.client.contactName)],
  ])
  drawTextBlock(context, 'Billing address', normaliseValue(invoice.client.billingAddress))

  if (invoice.notes) {
    drawTextBlock(context, 'Invoice notes', invoice.notes, 64)
  }

  drawRecordList(
    context,
    'Billable delivery lines',
    invoice.items.map((item) => ({
      title: `${item.waybillNumber} | ${item.orderReference}`,
      meta: `${normaliseValue(item.customerName)} | ${normaliseValue(item.completionTime)} | ${item.pricingTier}`,
      right: moneyValue(item.amountCents, invoice.currency),
    })),
    'No billable deliveries were attached to this invoice.',
  )

  return context.pdf.save()
}

export async function buildPodPdf(options: {
  waybill: WaybillDetail
  pod: ProofOfDelivery
  signatureImageBytes?: Uint8Array | null
}) {
  const context = createDocument(
    `POD ${options.waybill.waybillNumber}`,
    'PROOF OF DELIVERY',
  )
  const { waybill, pod, signatureImageBytes } = options

  drawDocumentHeader(context, {
    eyebrow: 'Completion record',
    title: 'Proof of Delivery',
    subtitle:
      'Recipient acknowledgement form generated from the final completion record after signature capture.',
    rightTopLabel: 'Waybill number',
    rightTopValue: waybill.waybillNumber,
    rightBottomLabel: 'Completed at',
    rightBottomValue: pod.completedAt,
  })

  drawSectionHeader(
    context,
    'Delivery reference',
    'Document references and dispatch facts used to confirm what was delivered, by whom, and for which client.',
  )
  drawFieldGrid(context, [
    ['Order reference', normaliseValue(waybill.orderReference)],
    ['Client account', normaliseValue(waybill.client?.name)],
    ['Assigned rider', normaliseValue(waybill.assignedRider?.name)],
    ['Dispatch time', normaliseValue(waybill.dispatchTime)],
    ['Delivery method', normaliseValue(waybill.deliveryMethod)],
    ['Customer phone', normaliseValue(waybill.customerPhone)],
  ])
  drawTextBlock(context, 'Delivery location', normaliseValue(waybill.deliveryAddress))

  drawSectionHeader(
    context,
    'Recipient acknowledgement',
    'Receiver details captured at delivery completion. Recipient name and review remain optional by design.',
  )
  drawFieldGrid(context, [
    ['Recipient name', normaliseValue(pod.recipientName)],
    ['Signature captured', normaliseValue(pod.signatureCapturedAt)],
    ['Delivery time', normaliseValue(waybill.completionTime)],
    ['Recorded by', normaliseValue(waybill.assignedRider?.name)],
  ])

  if (pod.note) {
    drawTextBlock(context, 'Recipient review', normaliseValue(pod.note), 64)
  } else {
    drawTextBlock(
      context,
      'Recipient review',
      'No recipient review or completion note was provided at the point of delivery.',
      64,
    )
  }

  drawSignatureBlock(context, signatureImageBytes)

  drawRecordList(
    context,
    'Status timeline',
    waybill.statusLogs.map((log: StatusLogEntry) => ({
      title: `${log.fromStatus} to ${log.toStatus}`,
      meta: `${normaliseValue(log.changedBy, 'Unknown user')}${log.note ? ` | ${log.note}` : ''}`,
      right: log.changedAt,
    })),
    'No status history has been recorded for this delivery.',
  )

  return context.pdf.save()
}
