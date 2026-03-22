import { eq, inArray } from 'drizzle-orm'
import { db, closeDatabase } from './client'
import {
  clients,
  invoiceItems,
  invoices,
  proofOfDeliveries,
  riderShiftHandovers,
  riderShifts,
  statusLogs,
  users,
  waybillHandovers,
  waybills,
} from './schema'
import { config } from '../config'
import { calculateDeliveryCharges, startOfBillingWeek } from '../lib/billing'
import { generateWaybillNumber } from '../lib/waybills'

type SeedUser = {
  id: string
  key: 'ops' | 'rider-one' | 'rider-two'
  name: string
  phone: string
  role: 'ops' | 'rider'
  defaultClientKey?: 'acme' | 'northline'
  profileImageUrl?: string
  profileImageMimeType?: string
  vehicleType?: string
  vehiclePlateNumber?: string
  licenseNumber?: string
  address?: string
  notes?: string
}

type SeedClient = {
  id: string
  key: 'acme' | 'northline'
  name: string
  contactName: string
  contactPhone: string
  contactEmail: string
  billingAddress: string
  currency: string
  paymentTermsDays: number
  standardDeliveryRateCents: number
  weeklyBandLimit: number | null
  overflowDeliveryRateCents: number | null
}

const DEMO_WAYBILL_IDS = [
  'seed-waybill-acme-queued-1',
  'seed-waybill-acme-queued-2',
  'seed-waybill-acme-dispatched',
  'seed-waybill-acme-live-uninvoiced',
  'seed-waybill-acme-historical-uninvoiced',
  'seed-waybill-acme-live-invoiced',
  'seed-waybill-acme-historical-invoiced',
  'seed-waybill-northline-live-paid',
  'seed-waybill-northline-failed',
] as const

const DEMO_INVOICE_IDS = [
  'seed-invoice-acme-issued',
  'seed-invoice-northline-paid',
] as const

const DEMO_SHIFT_IDS = [
  'seed-shift-rider-two-complete',
  'seed-shift-rider-one-active',
] as const

const DEMO_SHIFT_HANDOVER_IDS = ['seed-shift-handover-complete'] as const

const DEMO_WAYBILL_HANDOVER_IDS = ['seed-waybill-handover-live'] as const

function svgDataUrl(label: string, background: string, foreground: string) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" role="img" aria-label="${label}">
      <rect width="240" height="240" rx="32" fill="${background}" />
      <text x="120" y="132" text-anchor="middle" font-family="IBM Plex Sans, Arial, sans-serif" font-size="82" font-weight="700" fill="${foreground}">
        ${label}
      </text>
    </svg>
  `.trim()

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const receiptPreviewUrl = svgDataUrl('RC', '#f4efe5', '#21486b')
const signaturePreviewUrl = svgDataUrl('SG', '#eef3f7', '#13202b')

const seedClients: SeedClient[] = [
  {
    id: 'seed-client-acme',
    key: 'acme',
    name: 'Acme Retail',
    contactName: 'Operations Desk',
    contactPhone: '+233300000111',
    contactEmail: 'ops@acmeretail.test',
    billingAddress: 'Ring Road Central, Accra',
    currency: 'GHS',
    paymentTermsDays: 7,
    standardDeliveryRateCents: 3000,
    weeklyBandLimit: 5,
    overflowDeliveryRateCents: 2500,
  },
  {
    id: 'seed-client-northline',
    key: 'northline',
    name: 'Northline Pharmacy',
    contactName: 'Fulfilment Lead',
    contactPhone: '+233300000222',
    contactEmail: 'billing@northline.test',
    billingAddress: 'Osu Oxford Street, Accra',
    currency: 'GHS',
    paymentTermsDays: 14,
    standardDeliveryRateCents: 3500,
    weeklyBandLimit: 8,
    overflowDeliveryRateCents: 3000,
  },
]

const seedUsers: SeedUser[] = [
  {
    id: 'seed-user-ops',
    key: 'ops',
    name: 'Ops Control',
    phone: '+233200000002',
    role: 'ops',
    notes: 'Seeded operations account for demo workflow verification.',
  },
  {
    id: 'seed-user-rider-one',
    key: 'rider-one',
    name: 'Rider One',
    phone: '+233200000003',
    role: 'rider',
    defaultClientKey: 'acme',
    profileImageUrl: svgDataUrl('R1', '#dbe6ef', '#21486b'),
    profileImageMimeType: 'image/svg+xml',
    vehicleType: 'Motorbike',
    vehiclePlateNumber: 'GT-4821-24',
    licenseNumber: 'RID-0001',
    address: 'Spintex Road, Accra',
    notes: 'Primary rider for the active shift and recipient-signature flow.',
  },
  {
    id: 'seed-user-rider-two',
    key: 'rider-two',
    name: 'Rider Two',
    phone: '+233200000004',
    role: 'rider',
    defaultClientKey: 'northline',
    profileImageUrl: svgDataUrl('R2', '#e6ece5', '#2f4f3a'),
    profileImageMimeType: 'image/svg+xml',
    vehicleType: 'Motorbike',
    vehiclePlateNumber: 'GR-2715-25',
    licenseNumber: 'RID-0002',
    address: 'Madina Zongo Junction, Accra',
    notes: 'Seeded rider for handover, failure, and paid-invoice coverage.',
  },
]

function shiftDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function atUtc(base: Date, hour: number, minute = 0) {
  const next = new Date(base)
  next.setUTCHours(hour, minute, 0, 0)
  return next
}

async function upsertClient(client: SeedClient) {
  const existing = await db.query.clients.findFirst({
    where: eq(clients.name, client.name),
  })

  const values = {
    name: client.name,
    contactName: client.contactName,
    contactPhone: client.contactPhone,
    contactEmail: client.contactEmail,
    billingAddress: client.billingAddress,
    currency: client.currency,
    paymentTermsDays: client.paymentTermsDays,
    standardDeliveryRateCents: client.standardDeliveryRateCents,
    weeklyBandLimit: client.weeklyBandLimit,
    overflowDeliveryRateCents: client.overflowDeliveryRateCents,
    active: true,
  }

  if (existing) {
    await db.update(clients).set(values).where(eq(clients.id, existing.id))
    return existing.id
  }

  await db.insert(clients).values({
    id: client.id,
    ...values,
  })

  return client.id
}

async function upsertUser(
  user: SeedUser,
  passwordHash: string,
  clientIdsByKey: Map<SeedClient['key'], string>,
) {
  const existing = await db.query.users.findFirst({
    where: eq(users.phone, user.phone),
  })

  const values = {
    name: user.name,
    role: user.role,
    passwordHash,
    active: true,
    defaultClientId: user.defaultClientKey ? clientIdsByKey.get(user.defaultClientKey) ?? null : null,
    profileImageUrl: user.profileImageUrl ?? null,
    profileImageMimeType: user.profileImageMimeType ?? null,
    vehicleType: user.vehicleType ?? null,
    vehiclePlateNumber: user.vehiclePlateNumber ?? null,
    licenseNumber: user.licenseNumber ?? null,
    address: user.address ?? null,
    notes: user.notes ?? null,
  }

  if (existing) {
    await db.update(users).set(values).where(eq(users.id, existing.id))
    return existing.id
  }

  await db.insert(users).values({
    id: user.id,
    phone: user.phone,
    ...values,
  })

  return user.id
}

async function resetDemoData() {
  await db.delete(invoiceItems).where(
    inArray(invoiceItems.invoiceId, [...DEMO_INVOICE_IDS]),
  )
  await db.delete(invoiceItems).where(
    inArray(invoiceItems.waybillId, [...DEMO_WAYBILL_IDS]),
  )
  await db.delete(invoices).where(inArray(invoices.id, [...DEMO_INVOICE_IDS]))
  await db.delete(proofOfDeliveries).where(
    inArray(proofOfDeliveries.waybillId, [...DEMO_WAYBILL_IDS]),
  )
  await db.delete(waybillHandovers).where(
    inArray(waybillHandovers.id, [...DEMO_WAYBILL_HANDOVER_IDS]),
  )
  await db.delete(waybillHandovers).where(
    inArray(waybillHandovers.waybillId, [...DEMO_WAYBILL_IDS]),
  )
  await db.delete(statusLogs).where(inArray(statusLogs.waybillId, [...DEMO_WAYBILL_IDS]))
  await db.delete(riderShiftHandovers).where(
    inArray(riderShiftHandovers.id, [...DEMO_SHIFT_HANDOVER_IDS]),
  )
  await db.delete(riderShifts).where(inArray(riderShifts.id, [...DEMO_SHIFT_IDS]))
  await db.delete(waybills).where(inArray(waybills.id, [...DEMO_WAYBILL_IDS]))
}

async function run() {
  const passwordHash = await Bun.password.hash(config.seedDefaultPassword)
  const clientIdsByKey = new Map<SeedClient['key'], string>()

  for (const client of seedClients) {
    clientIdsByKey.set(client.key, await upsertClient(client))
  }

  const userIdsByKey = new Map<SeedUser['key'], string>()

  for (const user of seedUsers) {
    userIdsByKey.set(user.key, await upsertUser(user, passwordHash, clientIdsByKey))
  }

  await resetDemoData()

  const opsUserId = userIdsByKey.get('ops')
  const riderOneId = userIdsByKey.get('rider-one')
  const riderTwoId = userIdsByKey.get('rider-two')
  const acmeClientId = clientIdsByKey.get('acme')
  const northlineClientId = clientIdsByKey.get('northline')

  if (!opsUserId || !riderOneId || !riderTwoId || !acmeClientId || !northlineClientId) {
    throw new Error('Seed prerequisite users or clients were not created.')
  }

  const currentWeekStart = startOfBillingWeek(new Date())
  const lastWeekStart = shiftDays(currentWeekStart, -7)

  const acmeLiveInvoicedDispatch = atUtc(shiftDays(lastWeekStart, 1), 9, 20)
  const acmeLiveInvoicedComplete = atUtc(shiftDays(lastWeekStart, 1), 11, 5)
  const acmeHistoricalInvoicedDispatch = atUtc(shiftDays(lastWeekStart, 2), 14, 10)
  const acmeHistoricalInvoicedComplete = atUtc(shiftDays(lastWeekStart, 2), 16, 30)
  const northlinePaidDispatch = atUtc(shiftDays(lastWeekStart, 3), 10, 15)
  const northlinePaidComplete = atUtc(shiftDays(lastWeekStart, 3), 12, 10)

  const acmeLiveUninvoicedDispatch = atUtc(shiftDays(currentWeekStart, 1), 8, 35)
  const acmeLiveUninvoicedComplete = atUtc(shiftDays(currentWeekStart, 1), 10, 10)
  const acmeHistoricalUninvoicedDispatch = atUtc(shiftDays(currentWeekStart, 2), 13, 15)
  const acmeHistoricalUninvoicedComplete = atUtc(shiftDays(currentWeekStart, 2), 16, 5)
  const acmeDispatchedTime = atUtc(shiftDays(currentWeekStart, 3), 9, 5)
  const northlineFailedDispatch = atUtc(shiftDays(currentWeekStart, 3), 11, 0)
  const northlineFailedReturn = atUtc(shiftDays(currentWeekStart, 3), 14, 45)

  const activeShiftCheckIn = atUtc(shiftDays(currentWeekStart, 3), 7, 30)
  const outgoingShiftCheckIn = atUtc(shiftDays(currentWeekStart, 3), 6, 55)
  const outgoingShiftCheckOut = atUtc(shiftDays(currentWeekStart, 3), 7, 28)
  const shiftHandoverInitiated = atUtc(shiftDays(currentWeekStart, 3), 7, 20)
  const shiftHandoverCompleted = atUtc(shiftDays(currentWeekStart, 3), 7, 29)

  const queuedWaybills = [
    {
      id: 'seed-waybill-acme-queued-1',
      orderReference: 'ACM-QUEUE-001',
      sequence: 101,
      clientId: acmeClientId,
      customerName: 'Bernard Addo',
      customerPhone: '+233244444441',
      deliveryAddress: 'Airport Residential, Accra',
      deliveryMethod: 'cash',
      entryMode: 'live',
      deliveryProofMethod: 'signature',
      itemValueCents: 120000,
      receiptImageUrl: receiptPreviewUrl,
      receiptImageMimeType: 'image/svg+xml',
      notes: 'Queued for the rider batch-dispatch flow.',
      assignedRiderId: riderOneId,
      status: 'assigned' as const,
      createdBy: riderOneId,
      createdAt: atUtc(shiftDays(currentWeekStart, 3), 8, 10),
      updatedAt: atUtc(shiftDays(currentWeekStart, 3), 8, 16),
    },
    {
      id: 'seed-waybill-acme-queued-2',
      orderReference: 'ACM-QUEUE-002',
      sequence: 102,
      clientId: acmeClientId,
      customerName: 'Efua Mensah',
      customerPhone: '+233244444442',
      deliveryAddress: 'Labone, Accra',
      deliveryMethod: 'momo',
      entryMode: 'live',
      deliveryProofMethod: 'signature',
      itemValueCents: 86000,
      receiptImageUrl: receiptPreviewUrl,
      receiptImageMimeType: 'image/svg+xml',
      notes: 'Second queued waybill for bulk dispatch selection.',
      assignedRiderId: riderOneId,
      status: 'assigned' as const,
      createdBy: riderOneId,
      createdAt: atUtc(shiftDays(currentWeekStart, 3), 8, 18),
      updatedAt: atUtc(shiftDays(currentWeekStart, 3), 8, 24),
    },
    {
      id: 'seed-waybill-acme-dispatched',
      orderReference: 'ACM-LIVE-003',
      sequence: 103,
      clientId: acmeClientId,
      customerName: 'Kofi Tetteh',
      customerPhone: '+233244444443',
      deliveryAddress: 'East Legon, Accra',
      deliveryMethod: 'cash',
      entryMode: 'live',
      deliveryProofMethod: 'signature',
      itemValueCents: 145000,
      receiptImageUrl: receiptPreviewUrl,
      receiptImageMimeType: 'image/svg+xml',
      notes: 'Currently dispatched and waiting for recipient signature.',
      assignedRiderId: riderOneId,
      status: 'dispatched' as const,
      createdBy: riderOneId,
      createdAt: atUtc(shiftDays(currentWeekStart, 3), 8, 0),
      updatedAt: acmeDispatchedTime,
      dispatchTime: acmeDispatchedTime,
    },
    {
      id: 'seed-waybill-acme-live-uninvoiced',
      orderReference: 'ACM-LIVE-004',
      sequence: 104,
      clientId: acmeClientId,
      customerName: 'Ama Frimpong',
      customerPhone: '+233244444444',
      deliveryAddress: 'Cantonments, Accra',
      deliveryMethod: 'momo',
      entryMode: 'live',
      deliveryProofMethod: 'signature',
      itemValueCents: 95000,
      receiptImageUrl: receiptPreviewUrl,
      receiptImageMimeType: 'image/svg+xml',
      notes: 'Delivered this week but still uninvoiced.',
      assignedRiderId: riderOneId,
      status: 'delivered' as const,
      createdBy: riderOneId,
      createdAt: atUtc(shiftDays(currentWeekStart, 1), 7, 55),
      updatedAt: acmeLiveUninvoicedComplete,
      dispatchTime: acmeLiveUninvoicedDispatch,
      completionTime: acmeLiveUninvoicedComplete,
    },
    {
      id: 'seed-waybill-acme-historical-uninvoiced',
      orderReference: 'ACM-HIST-005',
      sequence: 105,
      clientId: acmeClientId,
      customerName: null,
      customerPhone: '+233244444445',
      deliveryAddress: 'Adabraka, Accra',
      deliveryMethod: 'cash',
      entryMode: 'historical',
      deliveryProofMethod: 'receipt_photo',
      itemValueCents: 60000,
      receiptImageUrl: receiptPreviewUrl,
      receiptImageMimeType: 'image/svg+xml',
      notes: 'Backfilled manual delivery with receipt-photo proof.',
      assignedRiderId: riderOneId,
      status: 'delivered' as const,
      createdBy: riderOneId,
      createdAt: atUtc(shiftDays(currentWeekStart, 2), 17, 0),
      updatedAt: acmeHistoricalUninvoicedComplete,
      dispatchTime: acmeHistoricalUninvoicedDispatch,
      completionTime: acmeHistoricalUninvoicedComplete,
    },
    {
      id: 'seed-waybill-acme-live-invoiced',
      orderReference: 'ACM-LIVE-001',
      sequence: 1,
      clientId: acmeClientId,
      customerName: 'Bernard Kirk',
      customerPhone: '+233244444446',
      deliveryAddress: 'Airport Hills, Accra',
      deliveryMethod: 'card',
      entryMode: 'live',
      deliveryProofMethod: 'signature',
      itemValueCents: 110000,
      receiptImageUrl: receiptPreviewUrl,
      receiptImageMimeType: 'image/svg+xml',
      notes: 'Last-week delivery already captured on the seeded invoice.',
      assignedRiderId: riderOneId,
      status: 'delivered' as const,
      createdBy: riderTwoId,
      createdAt: atUtc(shiftDays(lastWeekStart, 1), 8, 40),
      updatedAt: acmeLiveInvoicedComplete,
      dispatchTime: acmeLiveInvoicedDispatch,
      completionTime: acmeLiveInvoicedComplete,
    },
    {
      id: 'seed-waybill-acme-historical-invoiced',
      orderReference: 'ACM-HIST-002',
      sequence: 2,
      clientId: acmeClientId,
      customerName: null,
      customerPhone: '+233244444447',
      deliveryAddress: 'Tesano, Accra',
      deliveryMethod: 'bank_transfer',
      entryMode: 'historical',
      deliveryProofMethod: 'receipt_photo',
      itemValueCents: 70000,
      receiptImageUrl: receiptPreviewUrl,
      receiptImageMimeType: 'image/svg+xml',
      notes: 'Historical delivery already included on the issued invoice.',
      assignedRiderId: riderOneId,
      status: 'delivered' as const,
      createdBy: opsUserId,
      createdAt: atUtc(shiftDays(lastWeekStart, 2), 18, 0),
      updatedAt: acmeHistoricalInvoicedComplete,
      dispatchTime: acmeHistoricalInvoicedDispatch,
      completionTime: acmeHistoricalInvoicedComplete,
    },
    {
      id: 'seed-waybill-northline-live-paid',
      orderReference: 'NLP-LIVE-001',
      sequence: 3,
      clientId: northlineClientId,
      customerName: 'Linda Osei',
      customerPhone: '+233244444448',
      deliveryAddress: 'Osu, Accra',
      deliveryMethod: 'cash',
      entryMode: 'live',
      deliveryProofMethod: 'signature',
      itemValueCents: 132000,
      receiptImageUrl: receiptPreviewUrl,
      receiptImageMimeType: 'image/svg+xml',
      notes: 'Paid invoice example for testing invoice filters.',
      assignedRiderId: riderTwoId,
      status: 'delivered' as const,
      createdBy: riderTwoId,
      createdAt: atUtc(shiftDays(lastWeekStart, 3), 9, 0),
      updatedAt: northlinePaidComplete,
      dispatchTime: northlinePaidDispatch,
      completionTime: northlinePaidComplete,
    },
    {
      id: 'seed-waybill-northline-failed',
      orderReference: 'NLP-FAIL-002',
      sequence: 106,
      clientId: northlineClientId,
      customerName: 'Kojo Paintsil',
      customerPhone: '+233244444449',
      deliveryAddress: 'Haatso, Accra',
      deliveryMethod: 'other',
      entryMode: 'live',
      deliveryProofMethod: 'signature',
      itemValueCents: 54000,
      receiptImageUrl: receiptPreviewUrl,
      receiptImageMimeType: 'image/svg+xml',
      notes: 'Failed delivery for follow-up and return handling.',
      assignedRiderId: riderTwoId,
      status: 'failed' as const,
      createdBy: riderTwoId,
      createdAt: atUtc(shiftDays(currentWeekStart, 3), 10, 20),
      updatedAt: northlineFailedReturn,
      dispatchTime: northlineFailedDispatch,
      returnTime: northlineFailedReturn,
    },
  ]

  await db.insert(waybills).values(
    queuedWaybills.map((item) => ({
      id: item.id,
      waybillNumber: generateWaybillNumber(item.createdAt, item.sequence),
      orderReference: item.orderReference,
      clientId: item.clientId,
      customerName: item.customerName,
      customerPhone: item.customerPhone,
      deliveryAddress: item.deliveryAddress,
      deliveryMethod: item.deliveryMethod,
      entryMode: item.entryMode,
      deliveryProofMethod: item.deliveryProofMethod,
      itemValueCents: item.itemValueCents,
      receiptImageUrl: item.receiptImageUrl,
      receiptImageMimeType: item.receiptImageMimeType,
      notes: item.notes,
      dispatchTime: item.dispatchTime ?? null,
      completionTime: item.completionTime ?? null,
      returnTime: item.returnTime ?? null,
      assignedRiderId: item.assignedRiderId,
      status: item.status,
      createdBy: item.createdBy,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
  )

  const statusLogRows = [
    {
      id: 'seed-log-acme-queued-1-assigned',
      waybillId: 'seed-waybill-acme-queued-1',
      fromStatus: 'created',
      toStatus: 'assigned',
      changedBy: riderOneId,
      changedAt: atUtc(shiftDays(currentWeekStart, 3), 8, 16),
      note: 'Queued during seed workflow.',
    },
    {
      id: 'seed-log-acme-queued-2-assigned',
      waybillId: 'seed-waybill-acme-queued-2',
      fromStatus: 'created',
      toStatus: 'assigned',
      changedBy: riderOneId,
      changedAt: atUtc(shiftDays(currentWeekStart, 3), 8, 24),
      note: 'Queued during seed workflow.',
    },
    {
      id: 'seed-log-acme-dispatched-assigned',
      waybillId: 'seed-waybill-acme-dispatched',
      fromStatus: 'created',
      toStatus: 'assigned',
      changedBy: riderOneId,
      changedAt: atUtc(shiftDays(currentWeekStart, 3), 8, 6),
      note: 'Queued before route start.',
    },
    {
      id: 'seed-log-acme-dispatched-live',
      waybillId: 'seed-waybill-acme-dispatched',
      fromStatus: 'assigned',
      toStatus: 'dispatched',
      changedBy: riderOneId,
      changedAt: acmeDispatchedTime,
      note: 'Batch-dispatched with other queued route stops.',
    },
    {
      id: 'seed-log-acme-live-uninvoiced-assigned',
      waybillId: 'seed-waybill-acme-live-uninvoiced',
      fromStatus: 'created',
      toStatus: 'assigned',
      changedBy: riderOneId,
      changedAt: atUtc(shiftDays(currentWeekStart, 1), 8, 0),
      note: 'Queued by rider.',
    },
    {
      id: 'seed-log-acme-live-uninvoiced-dispatched',
      waybillId: 'seed-waybill-acme-live-uninvoiced',
      fromStatus: 'assigned',
      toStatus: 'dispatched',
      changedBy: riderOneId,
      changedAt: acmeLiveUninvoicedDispatch,
      note: 'Route started.',
    },
    {
      id: 'seed-log-acme-live-uninvoiced-delivered',
      waybillId: 'seed-waybill-acme-live-uninvoiced',
      fromStatus: 'dispatched',
      toStatus: 'delivered',
      changedBy: riderOneId,
      changedAt: acmeLiveUninvoicedComplete,
      note: 'Recipient signed on delivery.',
    },
    {
      id: 'seed-log-acme-historical-uninvoiced-delivered',
      waybillId: 'seed-waybill-acme-historical-uninvoiced',
      fromStatus: 'dispatched',
      toStatus: 'delivered',
      changedBy: riderOneId,
      changedAt: acmeHistoricalUninvoicedComplete,
      note: 'Backfilled from paper receipt.',
    },
    {
      id: 'seed-log-acme-live-invoiced-assigned',
      waybillId: 'seed-waybill-acme-live-invoiced',
      fromStatus: 'created',
      toStatus: 'assigned',
      changedBy: riderTwoId,
      changedAt: atUtc(shiftDays(lastWeekStart, 1), 8, 42),
      note: 'Initially queued by Rider Two.',
    },
    {
      id: 'seed-log-acme-live-invoiced-dispatched',
      waybillId: 'seed-waybill-acme-live-invoiced',
      fromStatus: 'assigned',
      toStatus: 'dispatched',
      changedBy: riderTwoId,
      changedAt: acmeLiveInvoicedDispatch,
      note: 'Dispatched before handover.',
    },
    {
      id: 'seed-log-acme-live-invoiced-delivered',
      waybillId: 'seed-waybill-acme-live-invoiced',
      fromStatus: 'dispatched',
      toStatus: 'delivered',
      changedBy: riderOneId,
      changedAt: acmeLiveInvoicedComplete,
      note: 'Recipient signed after mid-route handover.',
    },
    {
      id: 'seed-log-acme-historical-invoiced-delivered',
      waybillId: 'seed-waybill-acme-historical-invoiced',
      fromStatus: 'dispatched',
      toStatus: 'delivered',
      changedBy: opsUserId,
      changedAt: acmeHistoricalInvoicedComplete,
      note: 'Backfilled from manual records.',
    },
    {
      id: 'seed-log-northline-live-paid-assigned',
      waybillId: 'seed-waybill-northline-live-paid',
      fromStatus: 'created',
      toStatus: 'assigned',
      changedBy: riderTwoId,
      changedAt: atUtc(shiftDays(lastWeekStart, 3), 9, 5),
      note: 'Queued by Rider Two.',
    },
    {
      id: 'seed-log-northline-live-paid-dispatched',
      waybillId: 'seed-waybill-northline-live-paid',
      fromStatus: 'assigned',
      toStatus: 'dispatched',
      changedBy: riderTwoId,
      changedAt: northlinePaidDispatch,
      note: 'Route started.',
    },
    {
      id: 'seed-log-northline-live-paid-delivered',
      waybillId: 'seed-waybill-northline-live-paid',
      fromStatus: 'dispatched',
      toStatus: 'delivered',
      changedBy: riderTwoId,
      changedAt: northlinePaidComplete,
      note: 'Signed and later marked paid on invoice.',
    },
    {
      id: 'seed-log-northline-failed-assigned',
      waybillId: 'seed-waybill-northline-failed',
      fromStatus: 'created',
      toStatus: 'assigned',
      changedBy: riderTwoId,
      changedAt: atUtc(shiftDays(currentWeekStart, 3), 10, 24),
      note: 'Queued before failure.',
    },
    {
      id: 'seed-log-northline-failed-dispatched',
      waybillId: 'seed-waybill-northline-failed',
      fromStatus: 'assigned',
      toStatus: 'dispatched',
      changedBy: riderTwoId,
      changedAt: northlineFailedDispatch,
      note: 'Dispatched to rider route.',
    },
    {
      id: 'seed-log-northline-failed-returned',
      waybillId: 'seed-waybill-northline-failed',
      fromStatus: 'dispatched',
      toStatus: 'failed',
      changedBy: riderTwoId,
      changedAt: northlineFailedReturn,
      note: 'Recipient unavailable. Return required.',
    },
  ]

  await db.insert(statusLogs).values(statusLogRows)

  await db.insert(proofOfDeliveries).values([
    {
      id: 'seed-pod-acme-live-uninvoiced',
      waybillId: 'seed-waybill-acme-live-uninvoiced',
      recipientName: 'Ama Frimpong',
      signatureFileUrl: signaturePreviewUrl,
      signatureMimeType: 'image/svg+xml',
      signatureCapturedAt: acmeLiveUninvoicedComplete,
      completedAt: acmeLiveUninvoicedComplete,
      note: 'Fast doorstep handoff.',
      createdBy: riderOneId,
      createdAt: acmeLiveUninvoicedComplete,
    },
    {
      id: 'seed-pod-acme-live-invoiced',
      waybillId: 'seed-waybill-acme-live-invoiced',
      recipientName: 'Bernard Kirk',
      signatureFileUrl: signaturePreviewUrl,
      signatureMimeType: 'image/svg+xml',
      signatureCapturedAt: acmeLiveInvoicedComplete,
      completedAt: acmeLiveInvoicedComplete,
      note: 'Received in good order.',
      createdBy: riderOneId,
      createdAt: acmeLiveInvoicedComplete,
    },
    {
      id: 'seed-pod-northline-live-paid',
      waybillId: 'seed-waybill-northline-live-paid',
      recipientName: 'Linda Osei',
      signatureFileUrl: signaturePreviewUrl,
      signatureMimeType: 'image/svg+xml',
      signatureCapturedAt: northlinePaidComplete,
      completedAt: northlinePaidComplete,
      note: 'Customer signed and requested same-day confirmation.',
      createdBy: riderTwoId,
      createdAt: northlinePaidComplete,
    },
  ])

  await db.insert(riderShifts).values([
    {
      id: 'seed-shift-rider-two-complete',
      riderId: riderTwoId,
      startedBy: riderTwoId,
      endedBy: riderTwoId,
      status: 'completed',
      note: 'Morning coverage before handover.',
      checkInAt: outgoingShiftCheckIn,
      checkOutAt: outgoingShiftCheckOut,
      createdAt: outgoingShiftCheckIn,
    },
    {
      id: 'seed-shift-rider-one-active',
      riderId: riderOneId,
      startedBy: riderOneId,
      endedBy: null,
      status: 'active',
      note: 'Seeded active route-day shift.',
      checkInAt: activeShiftCheckIn,
      checkOutAt: null,
      createdAt: activeShiftCheckIn,
    },
  ])

  await db.insert(riderShiftHandovers).values({
    id: 'seed-shift-handover-complete',
    outgoingShiftId: 'seed-shift-rider-two-complete',
    outgoingRiderId: riderTwoId,
    incomingRiderId: riderOneId,
    initiatedBy: riderTwoId,
    completedBy: riderOneId,
    status: 'completed',
    note: 'Mid-morning rider replacement captured for audit trail.',
    initiatedAt: shiftHandoverInitiated,
    outgoingConfirmedAt: shiftHandoverInitiated,
    incomingConfirmedAt: shiftHandoverCompleted,
    completedAt: shiftHandoverCompleted,
  })

  await db.insert(waybillHandovers).values({
    id: 'seed-waybill-handover-live',
    waybillId: 'seed-waybill-acme-live-invoiced',
    fromRiderId: riderTwoId,
    toRiderId: riderOneId,
    note: 'Delivery transferred during rider shift change.',
    createdBy: riderTwoId,
    handedOverAt: atUtc(shiftDays(lastWeekStart, 1), 10, 10),
  })

  const acmeChargeMap = calculateDeliveryCharges(
    [
      {
        id: 'seed-waybill-acme-live-invoiced',
        clientId: acmeClientId,
        completionTime: acmeLiveInvoicedComplete,
      },
      {
        id: 'seed-waybill-acme-historical-invoiced',
        clientId: acmeClientId,
        completionTime: acmeHistoricalInvoicedComplete,
      },
    ],
    new Map([
      [
        acmeClientId,
        {
          clientId: acmeClientId,
          standardDeliveryRateCents: seedClients[0].standardDeliveryRateCents,
          weeklyBandLimit: seedClients[0].weeklyBandLimit,
          overflowDeliveryRateCents: seedClients[0].overflowDeliveryRateCents,
        },
      ],
    ]),
  )

  const northlineChargeMap = calculateDeliveryCharges(
    [
      {
        id: 'seed-waybill-northline-live-paid',
        clientId: northlineClientId,
        completionTime: northlinePaidComplete,
      },
    ],
    new Map([
      [
        northlineClientId,
        {
          clientId: northlineClientId,
          standardDeliveryRateCents: seedClients[1].standardDeliveryRateCents,
          weeklyBandLimit: seedClients[1].weeklyBandLimit,
          overflowDeliveryRateCents: seedClients[1].overflowDeliveryRateCents,
        },
      ],
    ]),
  )

  const acmeInvoiceItems = [
    {
      waybillId: 'seed-waybill-acme-live-invoiced',
      charge: acmeChargeMap.get('seed-waybill-acme-live-invoiced'),
    },
    {
      waybillId: 'seed-waybill-acme-historical-invoiced',
      charge: acmeChargeMap.get('seed-waybill-acme-historical-invoiced'),
    },
  ]

  const northlineInvoiceItem = northlineChargeMap.get('seed-waybill-northline-live-paid')

  if (acmeInvoiceItems.some((item) => !item.charge) || !northlineInvoiceItem) {
    throw new Error('Unable to derive delivery charges for seeded invoice rows.')
  }

  const acmeSubtotal = acmeInvoiceItems.reduce(
    (sum, item) => sum + (item.charge?.deliveryChargeCents ?? 0),
    0,
  )
  const northlineSubtotal = northlineInvoiceItem.deliveryChargeCents

  const acmeIssuedAt = atUtc(shiftDays(currentWeekStart, 0), 9, 0)
  const acmeDueAt = atUtc(shiftDays(currentWeekStart, 7), 17, 0)
  const northlineIssuedAt = atUtc(shiftDays(currentWeekStart, 0), 10, 0)
  const northlineDueAt = atUtc(shiftDays(currentWeekStart, 14), 17, 0)
  const northlinePaidAt = atUtc(shiftDays(currentWeekStart, 2), 16, 15)

  await db.insert(invoices).values([
    {
      id: 'seed-invoice-acme-issued',
      invoiceNumber: 'INV-DEMO-001',
      clientId: acmeClientId,
      currency: 'GHS',
      periodStart: atUtc(lastWeekStart, 0, 0),
      periodEnd: atUtc(shiftDays(lastWeekStart, 6), 23, 59),
      subtotalCents: acmeSubtotal,
      status: 'issued',
      issuedAt: acmeIssuedAt,
      dueAt: acmeDueAt,
      notes: 'Issued demo invoice mixing live and historical deliveries.',
      createdBy: opsUserId,
      createdAt: acmeIssuedAt,
    },
    {
      id: 'seed-invoice-northline-paid',
      invoiceNumber: 'INV-DEMO-002',
      clientId: northlineClientId,
      currency: 'GHS',
      periodStart: atUtc(lastWeekStart, 0, 0),
      periodEnd: atUtc(shiftDays(lastWeekStart, 6), 23, 59),
      subtotalCents: northlineSubtotal,
      status: 'paid',
      issuedAt: northlineIssuedAt,
      dueAt: northlineDueAt,
      paidAt: northlinePaidAt,
      notes: 'Paid demo invoice for workflow testing.',
      createdBy: opsUserId,
      createdAt: northlineIssuedAt,
    },
  ])

  await db.insert(invoiceItems).values([
    {
      id: 'seed-invoice-item-acme-live',
      invoiceId: 'seed-invoice-acme-issued',
      waybillId: 'seed-waybill-acme-live-invoiced',
      amountCents: acmeInvoiceItems[0].charge!.deliveryChargeCents,
      pricingTier: acmeInvoiceItems[0].charge!.pricingTier,
      createdAt: acmeIssuedAt,
    },
    {
      id: 'seed-invoice-item-acme-historical',
      invoiceId: 'seed-invoice-acme-issued',
      waybillId: 'seed-waybill-acme-historical-invoiced',
      amountCents: acmeInvoiceItems[1].charge!.deliveryChargeCents,
      pricingTier: acmeInvoiceItems[1].charge!.pricingTier,
      createdAt: acmeIssuedAt,
    },
    {
      id: 'seed-invoice-item-northline-live',
      invoiceId: 'seed-invoice-northline-paid',
      waybillId: 'seed-waybill-northline-live-paid',
      amountCents: northlineInvoiceItem.deliveryChargeCents,
      pricingTier: northlineInvoiceItem.pricingTier,
      createdAt: northlineIssuedAt,
    },
  ])

  console.log('Demo seed complete.')
  console.log(`Default password for seeded non-admin accounts: ${config.seedDefaultPassword}`)
  console.log('Seeded users:')
  console.log('  ops:        +233200000002')
  console.log('  rider one:  +233200000003')
  console.log('  rider two:  +233200000004')
  console.log('Seeded clients:')
  console.log('  Acme Retail')
  console.log('  Northline Pharmacy')
  console.log('Seeded coverage:')
  console.log('  queued, dispatched, delivered, failed, historical, invoiced, paid, and shift handover flows')
}

run()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await closeDatabase()
  })
