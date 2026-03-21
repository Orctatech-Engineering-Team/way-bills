import { describe, expect, test } from 'bun:test'
import { buildPodPdf, buildWaybillPdf } from './pdf'
import type { WaybillDetail } from './pdf.types'

const sampleWaybill: WaybillDetail = {
  id: 'waybill-1',
  waybillNumber: 'WB-20250320-0001',
  orderReference: 'ORDER-001',
  clientId: 'client-1',
  customerName: 'Jane Doe',
  customerPhone: '+233200000999',
  deliveryAddress: 'Airport Residential, Accra',
  deliveryMethod: 'momo',
  itemValueCents: 120000,
  notes: 'Leave at reception',
  requestedDispatchTime: '2025-03-20T09:00:00.000Z',
  dispatchTime: '2025-03-20T10:00:00.000Z',
  completionTime: '2025-03-20T12:00:00.000Z',
  returnTime: null,
  assignedRiderId: 'rider-1',
  status: 'delivered',
  createdBy: 'ops-1',
  createdAt: '2025-03-20T08:00:00.000Z',
  updatedAt: '2025-03-20T12:00:00.000Z',
  client: {
    id: 'client-1',
    name: 'Acme Retail',
    contactName: 'Acme Ops',
    contactPhone: '+233300000001',
    contactEmail: 'ops@acme.test',
    billingAddress: 'Spintex Road, Accra',
    currency: 'GHS',
    paymentTermsDays: 7,
    standardDeliveryRateCents: 3000,
    weeklyBandLimit: 20,
    overflowDeliveryRateCents: 2500,
    active: true,
    createdAt: '2025-03-01T08:00:00.000Z',
  },
  assignedRider: {
    id: 'rider-1',
    name: 'Rider One',
    phone: '+233200000003',
    role: 'rider',
  },
  pod: {
    id: 'pod-1',
    waybillId: 'waybill-1',
    recipientName: 'Front Desk',
    signatureFileUrl: 'https://example.com/signature.png',
    signatureMimeType: 'image/png',
    signatureCapturedAt: '2025-03-20T12:00:00.000Z',
    completedAt: '2025-03-20T12:00:00.000Z',
    note: 'Delivered safely',
    createdBy: 'rider-1',
    createdAt: '2025-03-20T12:00:00.000Z',
  },
  handovers: [],
  statusLogs: [
    {
      id: 'log-1',
      fromStatus: 'created',
      toStatus: 'assigned',
      changedAt: '2025-03-20T08:15:00.000Z',
      note: 'Assigned to rider',
      changedBy: 'Ops User',
    },
    {
      id: 'log-2',
      fromStatus: 'assigned',
      toStatus: 'dispatched',
      changedAt: '2025-03-20T10:00:00.000Z',
      note: null,
      changedBy: 'Rider One',
    },
  ],
}

describe('pdf generation', () => {
  test('buildWaybillPdf creates a valid pdf header', async () => {
    const bytes = await buildWaybillPdf(sampleWaybill)
    const header = new TextDecoder().decode(bytes.slice(0, 5))
    expect(header).toBe('%PDF-')
  })

  test('buildPodPdf creates a valid pdf header', async () => {
    const bytes = await buildPodPdf({
      waybill: sampleWaybill,
      pod: sampleWaybill.pod!,
      signatureImageBytes: null,
    })
    const header = new TextDecoder().decode(bytes.slice(0, 5))
    expect(header).toBe('%PDF-')
  })
})
