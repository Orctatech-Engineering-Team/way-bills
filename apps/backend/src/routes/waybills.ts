import { Hono } from 'hono'
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
} from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/client'
import {
  clients,
  documents,
  proofOfDeliveries,
  riderShifts,
  statusLogs,
  users,
  waybillHandovers,
  waybills,
  type DocumentType,
  type WaybillStatus,
} from '../db/schema'
import { requireAuth, type AppVariables } from '../lib/auth'
import { AppError, assert } from '../lib/errors'
import { parseJson } from '../lib/http'
import { decodeImageDataUrl } from '../lib/image'
import { buildPodPdf, buildWaybillPdf } from '../lib/pdf'
import type { WaybillDetail as PdfWaybillDetail } from '../lib/pdf.types'
import { decodeSignatureDataUrl } from '../lib/signature'
import {
  uploadDocumentFile,
  uploadSignatureFile,
  uploadWaybillReceiptFile,
} from '../lib/storage'
import {
  assertTransition,
  generateWaybillNumber,
} from '../lib/waybills'

const createWaybillSchema = z.object({
  orderReference: z.string().min(2),
  clientId: z.string().min(1),
  entryMode: z.enum(['live', 'historical']).default('live'),
  customerName: z.string().min(2).nullable().optional(),
  customerPhone: z.string().min(3),
  deliveryAddress: z.string().min(5),
  deliveryMethod: z.enum(['cash', 'momo', 'card', 'bank_transfer', 'other']),
  itemValueCents: z.number().int().min(0).nullable().optional(),
  receiptImageDataUrl: z.string().min(20).optional(),
  dispatchTime: z.string().datetime().nullable().optional(),
  completionTime: z.string().datetime().nullable().optional(),
  notes: z.string().nullable().optional(),
})

const assignWaybillSchema = z.object({
  riderId: z.string().min(1),
  note: z.string().optional(),
})

const updateStatusSchema = z.object({
  status: z.enum(['created', 'assigned', 'dispatched', 'delivered', 'failed', 'cancelled']),
  note: z.string().optional(),
})

const createPodSchema = z.object({
  recipientName: z.string().min(2).nullable().optional(),
  signatureDataUrl: z.string().min(20),
  note: z.string().nullable().optional(),
})

const batchDispatchSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(20),
})

const updateReceiptSchema = z.object({
  receiptImageDataUrl: z.string().min(20).nullable(),
})

const handoverWaybillSchema = z.object({
  riderId: z.string().min(1),
  note: z.string().nullable().optional(),
})

function canMutateWaybill(
  currentUser: AppVariables['user'],
  waybill: typeof waybills.$inferSelect,
) {
  if (currentUser.role === 'admin' || currentUser.role === 'ops') {
    return true
  }

  return waybill.assignedRiderId === currentUser.id
}

function waybillIsClosed(waybill: typeof waybills.$inferSelect) {
  return ['delivered', 'failed', 'cancelled'].includes(waybill.status)
}

function assertWaybillUnlocked(
  waybill: typeof waybills.$inferSelect,
  message = 'Completed or closed waybills can no longer be changed.',
) {
  assert(
    !waybillIsClosed(waybill),
    new AppError(409, 'locked_waybill', message),
  )
}

async function assertActiveRiderShift(riderId: string) {
  const activeShift = await db.query.riderShifts.findFirst({
    where: and(eq(riderShifts.riderId, riderId), eq(riderShifts.status, 'active')),
  })

  assert(
    activeShift,
    new AppError(
      409,
      'shift_required',
      'Check in to your shift before updating deliveries.',
    ),
  )
}

async function getWaybillDetail(id: string, currentUser: AppVariables['user']) {
  const waybill = await db.query.waybills.findFirst({
    where: eq(waybills.id, id),
  })

  assert(waybill, new AppError(404, 'not_found', 'Waybill not found.'))

  if (currentUser.role === 'rider') {
    assert(
      waybill.assignedRiderId === currentUser.id,
      new AppError(403, 'forbidden', 'You cannot access this waybill.'),
    )
  }

  const [client, assignedRider, pod, rawHandovers, logs] = await Promise.all([
    waybill.clientId
      ? db.query.clients.findFirst({ where: eq(clients.id, waybill.clientId) })
      : null,
    waybill.assignedRiderId
      ? db.query.users.findFirst({ where: eq(users.id, waybill.assignedRiderId) })
      : null,
    db.query.proofOfDeliveries.findFirst({
      where: eq(proofOfDeliveries.waybillId, id),
    }),
    db.query.waybillHandovers.findMany({
      where: eq(waybillHandovers.waybillId, id),
      orderBy: [desc(waybillHandovers.handedOverAt)],
    }),
    db
      .select({
        id: statusLogs.id,
        fromStatus: statusLogs.fromStatus,
        toStatus: statusLogs.toStatus,
        changedAt: statusLogs.changedAt,
        note: statusLogs.note,
        changedBy: users.name,
      })
      .from(statusLogs)
      .leftJoin(users, eq(users.id, statusLogs.changedBy))
      .where(eq(statusLogs.waybillId, id))
      .orderBy(desc(statusLogs.changedAt)),
  ])

  const relatedUserIds = Array.from(
    new Set(
      rawHandovers.flatMap((handover) =>
        [handover.fromRiderId, handover.toRiderId, handover.createdBy].filter(
          (value): value is string => Boolean(value),
        )),
    ),
  )

  const handoverUsers = relatedUserIds.length
    ? await db
        .select({
          id: users.id,
          name: users.name,
        })
        .from(users)
        .where(inArray(users.id, relatedUserIds))
    : []
  const userNameMap = new Map(handoverUsers.map((user) => [user.id, user.name]))
  const handovers = rawHandovers.map((handover) => ({
    id: handover.id,
    fromRiderId: handover.fromRiderId,
    fromRiderName: handover.fromRiderId
      ? userNameMap.get(handover.fromRiderId) ?? null
      : null,
    toRiderId: handover.toRiderId,
    toRiderName: userNameMap.get(handover.toRiderId) ?? null,
    note: handover.note,
    createdBy: userNameMap.get(handover.createdBy) ?? null,
    handedOverAt: handover.handedOverAt,
  }))

  return {
    ...waybill,
    client: client
      ? {
          id: client.id,
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
          active: client.active,
          createdAt: client.createdAt,
        }
      : null,
    assignedRider: assignedRider
      ? {
          id: assignedRider.id,
          name: assignedRider.name,
          phone: assignedRider.phone,
          role: assignedRider.role,
          profileImageUrl: assignedRider.profileImageUrl,
          profileImageMimeType: assignedRider.profileImageMimeType,
          vehicleType: assignedRider.vehicleType,
          vehiclePlateNumber: assignedRider.vehiclePlateNumber,
          licenseNumber: assignedRider.licenseNumber,
          address: assignedRider.address,
          notes: assignedRider.notes,
        }
      : null,
    pod,
    entryMode: waybill.entryMode,
    deliveryProofMethod: waybill.deliveryProofMethod,
    handovers,
    statusLogs: logs,
  }
}

function toPdfWaybillDetail(detail: Awaited<ReturnType<typeof getWaybillDetail>>): PdfWaybillDetail {
  return {
    ...detail,
    requestedDispatchTime: detail.requestedDispatchTime?.toISOString() ?? null,
    dispatchTime: detail.dispatchTime?.toISOString() ?? null,
    completionTime: detail.completionTime?.toISOString() ?? null,
    returnTime: detail.returnTime?.toISOString() ?? null,
    createdAt: detail.createdAt.toISOString(),
    updatedAt: detail.updatedAt.toISOString(),
    client: detail.client
      ? {
          ...detail.client,
          createdAt: detail.client.createdAt.toISOString(),
        }
      : null,
    assignedRider: detail.assignedRider
      ? {
          ...detail.assignedRider,
          role: detail.assignedRider.role,
        }
      : null,
    pod: detail.pod
      ? {
          ...detail.pod,
          signatureCapturedAt: detail.pod.signatureCapturedAt.toISOString(),
          completedAt: detail.pod.completedAt.toISOString(),
          createdAt: detail.pod.createdAt.toISOString(),
        }
      : null,
    handovers: detail.handovers.map((handover) => ({
      ...handover,
      handedOverAt: handover.handedOverAt.toISOString(),
    })),
    statusLogs: detail.statusLogs.map((log) => ({
      ...log,
      changedAt: log.changedAt.toISOString(),
    })),
  }
}

async function fetchSignatureBytes(signatureUrl: string) {
  try {
    const response = await fetch(signatureUrl)
    if (!response.ok) {
      return null
    }

    return new Uint8Array(await response.arrayBuffer())
  } catch {
    return null
  }
}

async function persistPdfDocument(options: {
  waybillId: string
  type: DocumentType
  bytes: Uint8Array
}) {
  const filename = options.type === 'waybill_pdf' ? 'waybill.pdf' : 'pod.pdf'
  const fileUrl = await uploadDocumentFile({
    bytes: options.bytes,
    path: `documents/${options.waybillId}/${filename}`,
  })

  const existing = await db.query.documents.findFirst({
    where: and(
      eq(documents.waybillId, options.waybillId),
      eq(documents.type, options.type),
    ),
  })

  if (existing) {
    await db
      .update(documents)
      .set({
        fileUrl,
        createdAt: new Date(),
      })
      .where(eq(documents.id, existing.id))

    return fileUrl
  }

  await db.insert(documents).values({
    id: crypto.randomUUID(),
    waybillId: options.waybillId,
    type: options.type,
    fileUrl,
    createdAt: new Date(),
  })

  return fileUrl
}

export const waybillRoutes = new Hono<{ Variables: AppVariables }>()
waybillRoutes.use('*', requireAuth)

waybillRoutes.post('/', async (c) => {
  const currentUser = c.get('user')
  assert(
    currentUser.role === 'rider',
    new AppError(403, 'forbidden', 'Only riders can create waybills.'),
  )

  const input = await parseJson(c, createWaybillSchema.parse)
  if (input.entryMode === 'live') {
    await assertActiveRiderShift(currentUser.id)
  }
  const [summary] = await db.select({ count: count() }).from(waybills)
  let receiptImageUrl: string | null = null
  let receiptImageMimeType: string | null = null
  const historicalCompletionAt =
    input.entryMode === 'historical' && input.completionTime
      ? new Date(input.completionTime)
      : null
  const historicalDispatchAt =
    input.entryMode === 'historical'
      ? input.dispatchTime
        ? new Date(input.dispatchTime)
        : historicalCompletionAt
      : null

  if (input.clientId) {
    const client = await db.query.clients.findFirst({
      where: eq(clients.id, input.clientId),
    })
    assert(client, new AppError(404, 'not_found', 'Client not found.'))
  }

  if (input.entryMode === 'historical') {
    assert(
      Boolean(input.receiptImageDataUrl),
      new AppError(
        400,
        'receipt_required',
        'A receipt photo is required for historical delivery records.',
      ),
    )
    assert(
      historicalCompletionAt && !Number.isNaN(historicalCompletionAt.getTime()),
      new AppError(
        400,
        'completion_time_required',
        'Completion time is required for historical delivery records.',
      ),
    )
    assert(
      !historicalDispatchAt || !Number.isNaN(historicalDispatchAt.getTime()),
      new AppError(
        400,
        'invalid_dispatch_time',
        'Dispatch time must be a valid date when provided.',
      ),
    )
    assert(
      !historicalDispatchAt || historicalDispatchAt.getTime() <= historicalCompletionAt.getTime(),
      new AppError(
        400,
        'invalid_historical_times',
        'Dispatch time cannot be after completion time.',
      ),
    )
  }

  if (input.receiptImageDataUrl) {
    const image = decodeImageDataUrl(input.receiptImageDataUrl)
    receiptImageUrl = await uploadWaybillReceiptFile({
      bytes: image.bytes,
      mimeType: image.mimeType,
      path: `waybills/${crypto.randomUUID()}/receipt.${image.extension}`,
    })
    receiptImageMimeType = image.mimeType
  }

  const now = new Date()
  const waybill = {
    id: crypto.randomUUID(),
    waybillNumber: generateWaybillNumber(now, summary.count + 1),
    orderReference: input.orderReference,
    clientId: input.clientId,
    customerName: input.customerName ?? null,
    customerPhone: input.customerPhone,
    deliveryAddress: input.deliveryAddress,
    deliveryMethod: input.deliveryMethod,
    entryMode: input.entryMode,
    deliveryProofMethod:
      input.entryMode === 'historical' ? 'receipt_photo' : 'signature',
    itemValueCents: input.itemValueCents ?? null,
    receiptImageUrl,
    receiptImageMimeType,
    notes: input.notes ?? null,
    requestedDispatchTime: null,
    dispatchTime: historicalDispatchAt,
    completionTime: historicalCompletionAt,
    assignedRiderId: currentUser.id,
    createdBy: currentUser.id,
    createdAt: now,
    updatedAt: now,
    status:
      input.entryMode === 'historical'
        ? ('delivered' as WaybillStatus)
        : ('assigned' as WaybillStatus),
  }

  await db.insert(waybills).values(waybill)
  if (input.entryMode === 'historical' && historicalCompletionAt) {
    const dispatchLoggedAt = historicalDispatchAt ?? historicalCompletionAt
    await db.insert(statusLogs).values([
      {
        id: crypto.randomUUID(),
        waybillId: waybill.id,
        fromStatus: 'created',
        toStatus: 'assigned',
        changedBy: currentUser.id,
        changedAt: now,
        note: 'Created as a historical delivery record.',
      },
      {
        id: crypto.randomUUID(),
        waybillId: waybill.id,
        fromStatus: 'assigned',
        toStatus: 'dispatched',
        changedBy: currentUser.id,
        changedAt: dispatchLoggedAt,
        note: 'Historical dispatch recorded from a previous manual delivery.',
      },
      {
        id: crypto.randomUUID(),
        waybillId: waybill.id,
        fromStatus: 'dispatched',
        toStatus: 'delivered',
        changedBy: currentUser.id,
        changedAt: historicalCompletionAt,
        note: 'Historical delivery closed using receipt-photo proof.',
      },
    ])
  } else {
    await db.insert(statusLogs).values({
      id: crypto.randomUUID(),
      waybillId: waybill.id,
      fromStatus: 'created',
      toStatus: 'assigned',
      changedBy: currentUser.id,
      changedAt: now,
      note: 'Created by rider and queued for dispatch.',
    })
  }

  const detail = await getWaybillDetail(waybill.id, currentUser)
  return c.json({ waybill: detail }, 201)
})

waybillRoutes.patch('/batch-dispatch', async (c) => {
  const currentUser = c.get('user')
  const input = await parseJson(c, batchDispatchSchema.parse)
  if (currentUser.role === 'rider') {
    await assertActiveRiderShift(currentUser.id)
  }

  const records = await db.query.waybills.findMany({
    where: inArray(waybills.id, input.ids),
  })

  assert(
    records.length === input.ids.length,
    new AppError(404, 'not_found', 'One or more waybills were not found.'),
  )

  const now = new Date()

  await db.transaction(async (tx) => {
    for (const record of records) {
      assert(
        canMutateWaybill(currentUser, record),
        new AppError(403, 'forbidden', 'You cannot dispatch one or more selected waybills.'),
      )
      assertTransition(record.status, 'dispatched')

      await tx
        .update(waybills)
        .set({
          status: 'dispatched',
          dispatchTime: now,
          updatedAt: now,
        })
        .where(eq(waybills.id, record.id))

      await tx.insert(statusLogs).values({
        id: crypto.randomUUID(),
        waybillId: record.id,
        fromStatus: record.status,
        toStatus: 'dispatched',
        changedBy: currentUser.id,
        changedAt: now,
        note: 'Batch dispatched.',
      })
    }
  })

  return c.json({
    success: true,
    count: records.length,
  })
})

waybillRoutes.get('/', async (c) => {
  const currentUser = c.get('user')
  const status = c.req.query('status')
  const search = c.req.query('search')
  const assignedRiderId = c.req.query('rider_id')
  const entryMode = c.req.query('entry_mode')
  const conditions = []

  if (currentUser.role === 'rider') {
    conditions.push(eq(waybills.assignedRiderId, currentUser.id))
    conditions.push(inArray(waybills.status, ['assigned', 'dispatched', 'failed']))
  }

  if (status) {
    conditions.push(eq(waybills.status, status as WaybillStatus))
  }

  if (assignedRiderId) {
    conditions.push(eq(waybills.assignedRiderId, assignedRiderId))
  }

  if (entryMode === 'live' || entryMode === 'historical') {
    conditions.push(eq(waybills.entryMode, entryMode))
  }

  if (search) {
    const pattern = `%${search}%`
    conditions.push(
      or(
        ilike(waybills.waybillNumber, pattern),
        ilike(waybills.orderReference, pattern),
        ilike(waybills.customerName, pattern),
        ilike(waybills.customerPhone, pattern),
      )!,
    )
  }

  const rows = await db
    .select({
      id: waybills.id,
      waybillNumber: waybills.waybillNumber,
      orderReference: waybills.orderReference,
      clientId: waybills.clientId,
      clientName: clients.name,
      customerName: waybills.customerName,
      customerPhone: waybills.customerPhone,
      deliveryAddress: waybills.deliveryAddress,
      deliveryMethod: waybills.deliveryMethod,
      entryMode: waybills.entryMode,
      deliveryProofMethod: waybills.deliveryProofMethod,
      itemValueCents: waybills.itemValueCents,
      assignedRiderId: waybills.assignedRiderId,
      status: waybills.status,
      requestedDispatchTime: waybills.requestedDispatchTime,
      dispatchTime: waybills.dispatchTime,
      completionTime: waybills.completionTime,
      returnTime: waybills.returnTime,
      updatedAt: waybills.updatedAt,
      riderName: users.name,
    })
    .from(waybills)
    .leftJoin(clients, eq(clients.id, waybills.clientId))
    .leftJoin(users, eq(users.id, waybills.assignedRiderId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(
      currentUser.role === 'rider'
        ? asc(waybills.status)
        : desc(waybills.createdAt),
    )

  return c.json({ items: rows, total: rows.length })
})

waybillRoutes.get('/:id', async (c) => {
  const detail = await getWaybillDetail(c.req.param('id'), c.get('user'))
  return c.json({ waybill: detail })
})

waybillRoutes.patch('/:id/receipt', async (c) => {
  const currentUser = c.get('user')
  if (currentUser.role === 'rider') {
    await assertActiveRiderShift(currentUser.id)
  }
  const waybillId = c.req.param('id')
  const input = await parseJson(c, updateReceiptSchema.parse)
  const existing = await db.query.waybills.findFirst({
    where: eq(waybills.id, waybillId),
  })

  assert(existing, new AppError(404, 'not_found', 'Waybill not found.'))
  assert(
    canMutateWaybill(currentUser, existing),
    new AppError(403, 'forbidden', 'You cannot manage this receipt image.'),
  )
  assertWaybillUnlocked(
    existing,
    'Completed or closed waybills can no longer have their receipt changed.',
  )

  if (input.receiptImageDataUrl === null) {
    await db
      .update(waybills)
      .set({
        receiptImageUrl: null,
        receiptImageMimeType: null,
        updatedAt: new Date(),
      })
      .where(eq(waybills.id, waybillId))
  } else {
    const image = decodeImageDataUrl(input.receiptImageDataUrl)
    const fileUrl = await uploadWaybillReceiptFile({
      bytes: image.bytes,
      mimeType: image.mimeType,
      path: `waybills/${waybillId}/receipt.${image.extension}`,
    })

    await db
      .update(waybills)
      .set({
        receiptImageUrl: fileUrl,
        receiptImageMimeType: image.mimeType,
        updatedAt: new Date(),
      })
      .where(eq(waybills.id, waybillId))
  }

  const detail = await getWaybillDetail(waybillId, currentUser)
  return c.json({ waybill: detail })
})

waybillRoutes.patch('/:id/handover', async (c) => {
  const currentUser = c.get('user')
  if (currentUser.role === 'rider') {
    await assertActiveRiderShift(currentUser.id)
  }
  const waybillId = c.req.param('id')
  const input = await parseJson(c, handoverWaybillSchema.parse)

  const rider = await db.query.users.findFirst({
    where: and(eq(users.id, input.riderId), eq(users.role, 'rider'), eq(users.active, true)),
  })

  assert(rider, new AppError(404, 'not_found', 'Replacement rider not found.'))

  await db.transaction(async (tx) => {
    const existing = await tx.query.waybills.findFirst({
      where: eq(waybills.id, waybillId),
    })

    assert(existing, new AppError(404, 'not_found', 'Waybill not found.'))
    assertWaybillUnlocked(
      existing,
      'Completed or closed waybills cannot be handed over.',
    )
    assert(
      canMutateWaybill(currentUser, existing),
      new AppError(403, 'forbidden', 'You cannot hand over this waybill.'),
    )
    assert(
      existing.assignedRiderId !== rider.id,
      new AppError(409, 'same_rider', 'This rider is already assigned to the waybill.'),
    )

    const now = new Date()
    await tx
      .update(waybills)
      .set({
        assignedRiderId: rider.id,
        updatedAt: now,
      })
      .where(eq(waybills.id, waybillId))

    await tx.insert(waybillHandovers).values({
      id: crypto.randomUUID(),
      waybillId,
      fromRiderId: existing.assignedRiderId,
      toRiderId: rider.id,
      note: input.note ?? null,
      createdBy: currentUser.id,
      handedOverAt: now,
    })
  })

  const detail = await getWaybillDetail(waybillId, currentUser)
  return c.json({ waybill: detail })
})

waybillRoutes.patch('/:id/assign', async (c) => {
  const currentUser = c.get('user')
  assert(
    currentUser.role === 'admin' || currentUser.role === 'ops',
    new AppError(403, 'forbidden', 'Only admin or ops can assign riders.'),
  )

  const waybillId = c.req.param('id')
  const input = await parseJson(c, assignWaybillSchema.parse)
  const rider = await db.query.users.findFirst({
    where: and(eq(users.id, input.riderId), eq(users.role, 'rider'), eq(users.active, true)),
  })

  assert(rider, new AppError(404, 'not_found', 'Rider not found.'))

  const updated = await db.transaction(async (tx) => {
    const existing = await tx.query.waybills.findFirst({
      where: eq(waybills.id, waybillId),
    })

    assert(existing, new AppError(404, 'not_found', 'Waybill not found.'))
    assertTransition(existing.status, 'assigned')

    await tx
      .update(waybills)
      .set({
        assignedRiderId: rider.id,
        status: 'assigned',
        updatedAt: new Date(),
      })
      .where(eq(waybills.id, waybillId))

    await tx.insert(statusLogs).values({
      id: crypto.randomUUID(),
      waybillId,
      fromStatus: existing.status,
      toStatus: 'assigned',
      changedBy: currentUser.id,
      changedAt: new Date(),
      note: input.note,
    })

    return tx.query.waybills.findFirst({
      where: eq(waybills.id, waybillId),
    })
  })

  return c.json({ waybill: updated })
})

waybillRoutes.patch('/:id/status', async (c) => {
  const currentUser = c.get('user')
  const waybillId = c.req.param('id')
  const input = await parseJson(c, updateStatusSchema.parse)
  if (currentUser.role === 'rider') {
    await assertActiveRiderShift(currentUser.id)
  }

  assert(
    input.status !== 'delivered' && input.status !== 'assigned',
    new AppError(
      400,
      'invalid_status',
      'Use rider assignment and POD endpoints for assigned and delivered states.',
    ),
  )

  const updated = await db.transaction(async (tx) => {
    const existing = await tx.query.waybills.findFirst({
      where: eq(waybills.id, waybillId),
    })

    assert(existing, new AppError(404, 'not_found', 'Waybill not found.'))
    assert(
      canMutateWaybill(currentUser, existing),
      new AppError(403, 'forbidden', 'You cannot update this waybill.'),
    )
    assertWaybillUnlocked(existing)
    assertTransition(existing.status, input.status)

    if (
      currentUser.role === 'rider' &&
      !['dispatched', 'failed'].includes(input.status)
    ) {
      throw new AppError(
        403,
        'forbidden',
        'Riders can only mark a job as dispatched or failed.',
      )
    }

    await tx
      .update(waybills)
      .set({
        status: input.status,
        dispatchTime:
          input.status === 'dispatched' ? new Date() : existing.dispatchTime,
        returnTime:
          input.status === 'failed' || input.status === 'cancelled'
            ? new Date()
            : existing.returnTime,
        updatedAt: new Date(),
      })
      .where(eq(waybills.id, waybillId))

    await tx.insert(statusLogs).values({
      id: crypto.randomUUID(),
      waybillId,
      fromStatus: existing.status,
      toStatus: input.status,
      changedBy: currentUser.id,
      changedAt: new Date(),
      note: input.note,
    })

    return tx.query.waybills.findFirst({
      where: eq(waybills.id, waybillId),
    })
  })

  return c.json({ waybill: updated })
})

waybillRoutes.post('/:id/pod', async (c) => {
  const currentUser = c.get('user')
  const waybillId = c.req.param('id')
  const input = await parseJson(c, createPodSchema.parse)
  const signature = decodeSignatureDataUrl(input.signatureDataUrl)
  if (currentUser.role === 'rider') {
    await assertActiveRiderShift(currentUser.id)
  }

  const updated = await db.transaction(async (tx) => {
    const existing = await tx.query.waybills.findFirst({
      where: eq(waybills.id, waybillId),
    })

    assert(existing, new AppError(404, 'not_found', 'Waybill not found.'))
    assert(
      canMutateWaybill(currentUser, existing),
      new AppError(403, 'forbidden', 'You cannot complete this waybill.'),
    )
    assertTransition(existing.status, 'delivered')

    const currentPod = await tx.query.proofOfDeliveries.findFirst({
      where: eq(proofOfDeliveries.waybillId, waybillId),
    })
    assert(
      !currentPod,
      new AppError(409, 'pod_exists', 'Proof of delivery already exists.'),
    )

    const now = new Date()
    const fileUrl = await uploadSignatureFile({
      bytes: signature.bytes,
      mimeType: signature.mimeType,
      path: `${waybillId}/${now.toISOString()}.${signature.extension}`,
    })

    const podId = crypto.randomUUID()
    await tx.insert(proofOfDeliveries).values({
      id: podId,
      waybillId,
      recipientName: input.recipientName ?? null,
      signatureFileUrl: fileUrl,
      signatureMimeType: signature.mimeType,
      signatureCapturedAt: now,
      completedAt: now,
      note: input.note ?? null,
      createdBy: currentUser.id,
      createdAt: now,
    })

    await tx
      .update(waybills)
      .set({
        status: 'delivered',
        completionTime: now,
        updatedAt: now,
      })
      .where(eq(waybills.id, waybillId))

    await tx.insert(statusLogs).values({
      id: crypto.randomUUID(),
      waybillId,
      fromStatus: existing.status,
      toStatus: 'delivered',
      changedBy: currentUser.id,
      changedAt: now,
      note: input.note ?? undefined,
    })

    return tx.query.proofOfDeliveries.findFirst({
      where: eq(proofOfDeliveries.waybillId, waybillId),
    })
  })

  return c.json({ pod: updated }, 201)
})

waybillRoutes.get('/:id/pod', async (c) => {
  const currentUser = c.get('user')
  const detail = await getWaybillDetail(c.req.param('id'), currentUser)
  assert(detail.pod, new AppError(404, 'not_found', 'POD not found.'))
  return c.json({ pod: detail.pod })
})

waybillRoutes.get('/:id/pdf', async (c) => {
  const detail = await getWaybillDetail(c.req.param('id'), c.get('user'))
  const bytes = await buildWaybillPdf(toPdfWaybillDetail(detail))
  await persistPdfDocument({
    waybillId: detail.id,
    type: 'waybill_pdf',
    bytes,
  })

  return new Response(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${detail.waybillNumber}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
})

waybillRoutes.get('/:id/pod/pdf', async (c) => {
  const detail = await getWaybillDetail(c.req.param('id'), c.get('user'))
  assert(detail.pod, new AppError(404, 'not_found', 'POD not found.'))

  const signatureBytes = await fetchSignatureBytes(detail.pod.signatureFileUrl)
  const pdfDetail = toPdfWaybillDetail(detail)
  const bytes = await buildPodPdf({
    waybill: pdfDetail,
    pod: pdfDetail.pod!,
    signatureImageBytes: signatureBytes,
  })
  await persistPdfDocument({
    waybillId: detail.id,
    type: 'pod_pdf',
    bytes,
  })

  return new Response(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${detail.waybillNumber}-pod.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
})
