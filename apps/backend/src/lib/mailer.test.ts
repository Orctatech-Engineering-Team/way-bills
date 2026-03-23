import { describe, expect, test } from 'bun:test'
import { buildInvoiceEmailContent } from './mailer'

describe('invoice mailer content', () => {
  test('builds an invoice email with attachment metadata', () => {
    const content = buildInvoiceEmailContent({
      invoiceNumber: 'INV-20260323-001',
      clientName: 'Acme Retail',
      contactName: 'Ama Owusu',
      recipientEmail: 'billing@example.com',
      periodStart: '16 Mar 2026',
      periodEnd: '22 Mar 2026',
      subtotalLabel: 'GHS 120.00',
      dueAt: '29 Mar 2026',
      attachmentBytes: new Uint8Array([1, 2, 3]),
    })

    expect(content.subject).toBe('Invoice INV-20260323-001')
    expect(content.to).toBe('billing@example.com')
    expect(content.attachmentFilename).toBe('INV-20260323-001.pdf')
    expect(content.text).toContain('Ama Owusu')
    expect(content.html).toContain('INV-20260323-001')
  })
})
