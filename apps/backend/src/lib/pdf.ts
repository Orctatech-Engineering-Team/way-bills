import { PDF, StandardFonts, rgb, ops, PdfString, type RGB, type EmbeddedFont } from '@libpdf/core'
import type {
  InvoicePdfDetail,
  ProofOfDelivery,
  StatusLogEntry,
  WaybillDetail,
} from './pdf.types'
import { startOfBillingWeek } from './billing'

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

// ─────────────────────────────────────────────────────────────────────────────
// Brand configuration  (override any field via environment variables)
// ─────────────────────────────────────────────────────────────────────────────

const BRAND = {
  companyName:   Bun.env.COMPANY_NAME          ?? 'Orcta Technologies',
  ceoName:       Bun.env.CEO_NAME              ?? 'Mark Owusu Agyemang',
  ceoTitle:      Bun.env.CEO_TITLE             ?? 'Chief Executive Officer',
  phone:         Bun.env.COMPANY_PHONE         ?? '+233 50 271 6271',
  email:         Bun.env.COMPANY_EMAIL         ?? 'info@orctatech.com',
  bankName:      Bun.env.BANK_NAME             ?? 'Call Bank',
  accountNumber: Bun.env.BANK_ACCOUNT_NUMBER   ?? '1400009200241',
  accountName:   Bun.env.BANK_ACCOUNT_NAME     ?? 'Orcta Technologies',
} as const

const INV_BLUE     = rgb(0.13, 0.22, 0.72)
const INV_CHARCOAL = rgb(0.26, 0.26, 0.28)
const INV_INK      = rgb(0.08, 0.10, 0.13)
const INV_LINE     = rgb(0.76, 0.77, 0.79)

// ─────────────────────────────────────────────────────────────────────────────
// Invoice helpers
// ─────────────────────────────────────────────────────────────────────────────

function invFormatDate(iso: string): string {
  const d  = new Date(iso)
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getUTCFullYear()}`
}

function invDueLabel(issuedAt: string, dueAt: string): string {
  const days = Math.round(
    (new Date(dueAt).getTime() - new Date(issuedAt).getTime()) / 86_400_000,
  )
  if (days <= 0) return 'IMMEDIATELY'
  return `IN ${days} DAY${days === 1 ? '' : 'S'}`
}

function invMoney(cents: number, currency: string, compact = false): string {
  const amount = (cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: compact ? 0 : 2,
    maximumFractionDigits: 2,
  })
  const symbol = currency === 'GHS' ? '\u20B5' : `${currency} `
  return `${symbol}${amount}`
}

type InvWeek = {
  label:      string
  unit:       number
  priceCents: number | null   // null = flat / mixed rate
  totalCents: number
}

function groupByWeek(items: InvoicePdfDetail['items']): InvWeek[] {
  const map  = new Map<string, InvoicePdfDetail['items']>()
  const misc: InvoicePdfDetail['items'] = []

  for (const item of items) {
    if (!item.completionTime) { misc.push(item); continue }
    const key = startOfBillingWeek(new Date(item.completionTime)).toISOString().slice(0, 10)
    const g   = map.get(key) ?? []
    g.push(item)
    map.set(key, g)
  }

  const weeks = [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, wItems], i) => {
      const totalCents = wItems.reduce((s, x) => s + x.amountCents, 0)
      const rates      = new Set(wItems.map(x => x.amountCents))
      const allStd     = wItems.every(x => x.pricingTier === 'standard')
      return {
        label:      `Week ${i + 1}`,
        unit:       wItems.length,
        priceCents: rates.size === 1 && allStd ? wItems[0].amountCents : null,
        totalCents,
      }
    })

  if (misc.length > 0) {
    weeks.push({
      label:      'Misc',
      unit:       misc.length,
      priceCents: null,
      totalCents: misc.reduce((s, x) => s + x.amountCents, 0),
    })
  }
  return weeks
}

function drawSpacedText(
  page:  ReturnType<PDF['addPage']>,
  text:  string,
  x:     number,
  y:     number,
  size:  number,
  color: RGB,
  spacing: number,
  font:  EmbeddedFont,
) {
  const fontName = page.registerFont(font)
  const codes    = font.encodeText(text)
  const hexStr   = codes.map((c: number) => c.toString(16).padStart(4, '0')).join('')
  const pdfStr   = PdfString.fromHex(hexStr)

  page.drawOperators([
    ops.pushGraphicsState(),
    ops.beginText(),
    ops.setNonStrokingRGB(color.red, color.green, color.blue),
    ops.setCharSpacing(spacing),
    ops.setFont(fontName, size),
    ops.setTextMatrix(1, 0, 0, 1, x, y),
    ops.showText(pdfStr),
    ops.endText(),
    ops.popGraphicsState(),
  ])
}

// ─────────────────────────────────────────────────────────────────────────────
// buildInvoicePdf  – branded Orcta layout
// ─────────────────────────────────────────────────────────────────────────────

export async function buildInvoicePdf(invoice: InvoicePdfDetail) {
  // Load brand assets (non-fatal if unavailable)
  let logoBytes:    Uint8Array | null = null
  let sigBytes:     Uint8Array | null = null
  let regularBytes: Uint8Array | null = null
  let boldBytes:    Uint8Array | null = null

  try { logoBytes    = await Bun.file(new URL('./assets/logo.jpg',           import.meta.url)).bytes() } catch { /* skip */ }
  try { sigBytes     = await Bun.file(new URL('./assets/signature.jpg',      import.meta.url)).bytes() } catch { /* skip */ }
  try { regularBytes = await Bun.file(new URL('./assets/NotoSans-Regular.ttf', import.meta.url)).bytes() } catch { /* skip */ }
  try { boldBytes    = await Bun.file(new URL('./assets/NotoSans-Bold.ttf',    import.meta.url)).bytes() } catch { /* skip */ }

  const pdf = PDF.create()
  pdf.setTitle(`Invoice ${invoice.invoiceNumber}`)
  pdf.setAuthor(BRAND.companyName)
  pdf.setCreator(BRAND.companyName)
  pdf.setProducer('@libpdf/core')
  pdf.setCreationDate(new Date())
  pdf.setModificationDate(new Date())

  const page      = pdf.addPage({ size: 'letter' })
  const logoImage = logoBytes ? pdf.embedJpeg(logoBytes) : null
  const sigImage  = sigBytes  ? pdf.embedJpeg(sigBytes)  : null

  // Embed Noto Sans for full Unicode support (₵ etc.)
  // Falls back to standard Helvetica if fonts are unavailable.
  const regularFont: EmbeddedFont | null = regularBytes ? pdf.embedFont(regularBytes) : null
  const boldFont:    EmbeddedFont | null = boldBytes    ? pdf.embedFont(boldBytes)    : null

  const fontRegular = (regularFont ?? StandardFonts.Helvetica)     as EmbeddedFont
  const fontBold    = (boldFont    ?? StandardFonts.HelveticaBold)  as EmbeddedFont

  const M = 50  // page margin

  // ── Decorative parallelograms – top-left header ───────────────────────────
  page.drawPath()
    .moveTo(0, PAGE_HEIGHT - 38).lineTo(0, PAGE_HEIGHT)
    .lineTo(220, PAGE_HEIGHT).lineTo(152, PAGE_HEIGHT - 38)
    .close().fill({ color: INV_BLUE })

  page.drawPath()
    .moveTo(168, PAGE_HEIGHT - 38).lineTo(200, PAGE_HEIGHT)
    .lineTo(264, PAGE_HEIGHT).lineTo(232, PAGE_HEIGHT - 38)
    .close().fill({ color: INV_CHARCOAL })

  // ── Decorative parallelograms – bottom-right footer ───────────────────────
  page.drawPath()
    .moveTo(PAGE_WIDTH - 220, 0).lineTo(PAGE_WIDTH - 152, 38)
    .lineTo(PAGE_WIDTH, 38).lineTo(PAGE_WIDTH, 0)
    .close().fill({ color: INV_BLUE })

  page.drawPath()
    .moveTo(PAGE_WIDTH - 264, 0).lineTo(PAGE_WIDTH - 232, 38)
    .lineTo(PAGE_WIDTH - 168, 38).lineTo(PAGE_WIDTH - 200, 0)
    .close().fill({ color: INV_CHARCOAL })

  // ── Invoice number (wide-spaced) + logo ───────────────────────────────────
  const titleY  = PAGE_HEIGHT - 80
  const seqPart = (invoice.invoiceNumber.split('-').pop() ?? '0000').padStart(4, '0')
  drawSpacedText(page, `INVOICE #${seqPart}`, M, titleY, 22, INV_BLUE, 2.5, fontBold)

  if (logoImage) {
    const lh = 26
    const lw = Math.round((logoImage.width / logoImage.height) * lh)
    page.drawImage(logoImage, { x: PAGE_WIDTH - M - lw, y: titleY, width: lw, height: lh })
  }

  // ── Issued / Due dates ────────────────────────────────────────────────────
  page.drawText(`ISSUED: ${invFormatDate(invoice.issuedAt)}`, {
    x: M, y: titleY - 28,
    font: fontBold, size: 8.5, color: INV_INK,
  })
  page.drawText(`DUE: ${invDueLabel(invoice.issuedAt, invoice.dueAt)}`, {
    x: M, y: titleY - 42,
    font: fontBold, size: 8.5, color: INV_INK,
  })

  // ── Rule 1 ────────────────────────────────────────────────────────────────
  const rule1Y = titleY - 58
  page.drawLine({
    start: { x: M, y: rule1Y }, end: { x: PAGE_WIDTH - M, y: rule1Y },
    color: INV_LINE, thickness: 0.75,
  })

  // ── Bill To / Payable To ──────────────────────────────────────────────────
  const billY = rule1Y - 16
  const halfW = (PAGE_WIDTH - M * 2) / 2
  const payX  = M + halfW

  page.drawText('BILL TO:', { x: M, y: billY, font: fontBold, size: 9, color: INV_INK })
  page.drawText(invoice.client.name, {
    x: M, y: billY - 16,
    font: fontRegular, size: 10, color: INV_INK, maxWidth: halfW - 10,
  })

  page.drawText('PAYABLE TO:', { x: payX, y: billY, font: fontBold, size: 9, color: INV_INK })
  const bankLines = [
    `Bank - ${BRAND.bankName}`,
    `Account Number - ${BRAND.accountNumber}`,
    `Account Name - ${BRAND.accountName}`,
  ]
  bankLines.forEach((line, i) => {
    page.drawText(line, {
      x: payX, y: billY - 16 - i * 14,
      font: fontRegular, size: 9.5, color: INV_INK, maxWidth: halfW - 10,
    })
  })

  // ── Rule 2 ────────────────────────────────────────────────────────────────
  const rule2Y = billY - 68
  page.drawLine({
    start: { x: M, y: rule2Y }, end: { x: PAGE_WIDTH - M, y: rule2Y },
    color: INV_LINE, thickness: 0.75,
  })

  // ── Table column layout ───────────────────────────────────────────────────
  // DESCRIPTION | UNIT | PRICE | NET SUBTOTAL
  const CW        = PAGE_WIDTH - M * 2
  const colDescX  = M
  const colDescW  = Math.round(CW * 0.44)
  const colUnitX  = colDescX  + colDescW  + 4
  const colUnitW  = Math.round(CW * 0.12)
  const colPriceX = colUnitX  + colUnitW  + 4
  const colPriceW = Math.round(CW * 0.16)
  const colSubX   = colPriceX + colPriceW + 4
  const colSubW   = PAGE_WIDTH - M - colSubX

  // Header row
  const tHdrY = rule2Y - 22
  page.drawText('DESCRIPTION',  { x: colDescX,  y: tHdrY, font: fontBold, size: 8.5, color: INV_INK })
  page.drawText('UNIT',         { x: colUnitX,  y: tHdrY, font: fontBold, size: 8.5, color: INV_INK, maxWidth: colUnitW,  alignment: 'center' })
  page.drawText('PRICE',        { x: colPriceX, y: tHdrY, font: fontBold, size: 8.5, color: INV_INK, maxWidth: colPriceW, alignment: 'center' })
  page.drawText('NET SUBTOTAL', { x: colSubX,   y: tHdrY, font: fontBold, size: 8.5, color: INV_INK, maxWidth: colSubW,   alignment: 'right'  })

  const tLineY = tHdrY - 12
  page.drawLine({ start: { x: M, y: tLineY }, end: { x: PAGE_WIDTH - M, y: tLineY }, color: INV_LINE, thickness: 0.5 })

  // Data rows
  const weeks = groupByWeek(invoice.items)
  const rowH  = 36
  let   rowY  = tLineY - 18

  for (const week of weeks) {
    page.drawText(week.label, { x: colDescX, y: rowY, font: fontRegular, size: 10, color: INV_INK })
    page.drawText(String(week.unit), {
      x: colUnitX, y: rowY,
      font: fontRegular, size: 10, color: INV_INK, maxWidth: colUnitW, alignment: 'center',
    })
    const priceStr = week.priceCents !== null
      ? invMoney(week.priceCents, invoice.currency, true)
      : 'Flat Rate'
    page.drawText(priceStr, {
      x: colPriceX, y: rowY,
      font: fontRegular, size: 10, color: INV_INK, maxWidth: colPriceW, alignment: 'center',
    })
    page.drawText(invMoney(week.totalCents, invoice.currency), {
      x: colSubX, y: rowY,
      font: fontRegular, size: 10, color: INV_INK, maxWidth: colSubW, alignment: 'right',
    })
    // Row separator
    page.drawLine({
      start: { x: M, y: rowY - 18 }, end: { x: PAGE_WIDTH - M, y: rowY - 18 },
      color: INV_LINE, thickness: 0.3,
    })
    rowY -= rowH
  }

  // ── Total row ─────────────────────────────────────────────────────────────
  const totalBarY = rowY - 6
  page.drawLine({
    start: { x: colSubX, y: totalBarY }, end: { x: PAGE_WIDTH - M, y: totalBarY },
    color: INV_INK, thickness: 0.75,
  })

  const totalRowY = totalBarY - 18
  page.drawText('TOTAL', {
    x: colPriceX, y: totalRowY,
    font: fontBold, size: 9.5, color: INV_INK, maxWidth: colPriceW, alignment: 'right',
  })
  page.drawText(invMoney(invoice.subtotalCents, invoice.currency), {
    x: colSubX, y: totalRowY,
    font: fontBold, size: 10, color: INV_INK, maxWidth: colSubW, alignment: 'right',
  })

  // ── Amount Due ────────────────────────────────────────────────────────────
  const amtDueY = totalRowY - 42
  drawSpacedText(
    page,
    `AMOUNT DUE:  ${invMoney(invoice.subtotalCents, invoice.currency)}`,
    M + 90, amtDueY, 16, INV_BLUE, 2, fontBold,
  )

  // ── Signature block ───────────────────────────────────────────────────────
  let dotY = amtDueY - 110

  if (sigImage) {
    const sigW    = 110
    const sigH    = Math.round((sigImage.height / sigImage.width) * sigW)
    const sigTopY = amtDueY - 26
    page.drawImage(sigImage, { x: M, y: sigTopY - sigH, width: sigW, height: sigH })
    dotY = sigTopY - sigH - 10
  }

  // Dotted line under signature image
  page.drawLine({
    start: { x: M, y: dotY }, end: { x: M + 190, y: dotY },
    color: INV_INK, thickness: 0.75, dashArray: [2, 3], dashPhase: 0,
  })
  page.drawText(BRAND.ceoTitle, { x: M, y: dotY - 14, font: fontBold,    size: 9.5, color: INV_INK })
  page.drawText(BRAND.ceoName,  { x: M, y: dotY - 28, font: fontRegular, size: 9.5, color: INV_INK })

  // ── Footer contacts ───────────────────────────────────────────────────────
  const footerY = 58
  const r       = 8

  // Phone icon (filled blue circle + white "T")
  page.drawPath().circle(M + r, footerY + r, r).fill({ color: INV_BLUE })
  page.drawText('T', { x: M + r - 3, y: footerY + r - 3, font: fontBold,    size: 7,   color: rgb(1, 1, 1) })
  page.drawText(BRAND.phone, { x: M + r * 2 + 5, y: footerY + 3, font: fontRegular, size: 9.5, color: INV_INK })

  // Email icon (filled blue circle + white "@")
  const emX = M + 180
  page.drawPath().circle(emX + r, footerY + r, r).fill({ color: INV_BLUE })
  page.drawText('@', { x: emX + r - 4, y: footerY + r - 3, font: fontBold,    size: 7,   color: rgb(1, 1, 1) })
  page.drawText(BRAND.email, { x: emX + r * 2 + 5, y: footerY + 3, font: fontRegular, size: 9.5, color: INV_INK })

  return pdf.save()
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
