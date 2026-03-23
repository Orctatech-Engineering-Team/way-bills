import { Hono } from 'hono'
import { and, desc, eq, gte, inArray, isNull, lte, or } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/client'
import {
  riderShifts,
  riderShiftHandovers,
  users,
} from '../db/schema'
import { requireAuth, type AppVariables } from '../lib/auth'
import { AppError, assert } from '../lib/errors'
import { parseInput, parseJson } from '../lib/http'
import { buildShiftTimeline, computeShiftReportTotals } from '../lib/shifts'
import { dateOnlyField, optionalNullableText, requiredId } from '../lib/validation'

const checkInSchema = z.object({
  note: optionalNullableText('Shift note', 2),
})

const startHandoverSchema = z.object({
  incomingRiderId: requiredId('Incoming rider'),
  note: optionalNullableText('Handover note', 2),
})

const acceptHandoverSchema = z.object({
  note: optionalNullableText('Handover note', 2),
})

const shiftReportQuerySchema = z.object({
  start: dateOnlyField('Shift report start date'),
  end: dateOnlyField('Shift report end date'),
  riderId: requiredId('Rider').optional(),
})

async function getActiveShift(riderId: string) {
  return db.query.riderShifts.findFirst({
    where: and(eq(riderShifts.riderId, riderId), eq(riderShifts.status, 'active')),
    orderBy: [desc(riderShifts.checkInAt)],
  })
}

async function getShiftDashboard(riderId: string) {
  const [activeShift, pendingIncomingHandovers, pendingOutgoingHandovers, shifts] =
    await Promise.all([
      getActiveShift(riderId),
      db.query.riderShiftHandovers.findMany({
        where: and(
          eq(riderShiftHandovers.incomingRiderId, riderId),
          eq(riderShiftHandovers.status, 'pending'),
        ),
        orderBy: [desc(riderShiftHandovers.initiatedAt)],
      }),
      db.query.riderShiftHandovers.findMany({
        where: and(
          eq(riderShiftHandovers.outgoingRiderId, riderId),
          eq(riderShiftHandovers.status, 'pending'),
        ),
        orderBy: [desc(riderShiftHandovers.initiatedAt)],
      }),
      db.query.riderShifts.findMany({
        where: eq(riderShifts.riderId, riderId),
        orderBy: [desc(riderShifts.checkInAt)],
        limit: 12,
      }),
    ])

  const historicalHandovers = await db.query.riderShiftHandovers.findMany({
    where: eq(riderShiftHandovers.outgoingRiderId, riderId),
    orderBy: [desc(riderShiftHandovers.initiatedAt)],
    limit: 12,
  })

  const relatedUserIds = Array.from(
    new Set(
      [...pendingIncomingHandovers, ...pendingOutgoingHandovers, ...historicalHandovers].flatMap(
        (item) => [item.outgoingRiderId, item.incomingRiderId, item.initiatedBy, item.completedBy].filter(
          (value): value is string => Boolean(value),
        ),
      ),
    ),
  )

  const relatedUsers = relatedUserIds.length
    ? await db
        .select({
          id: users.id,
          name: users.name,
        })
        .from(users)
        .where(inArray(users.id, relatedUserIds))
    : []
  const userNameMap = new Map(relatedUsers.map((item) => [item.id, item.name]))

  const serializeHandover = (handover: typeof riderShiftHandovers.$inferSelect) => ({
    id: handover.id,
    outgoingShiftId: handover.outgoingShiftId,
    outgoingRiderId: handover.outgoingRiderId,
    outgoingRiderName: userNameMap.get(handover.outgoingRiderId) ?? null,
    incomingRiderId: handover.incomingRiderId,
    incomingRiderName: userNameMap.get(handover.incomingRiderId) ?? null,
    initiatedBy: userNameMap.get(handover.initiatedBy) ?? null,
    completedBy: handover.completedBy ? userNameMap.get(handover.completedBy) ?? null : null,
    status: handover.status,
    note: handover.note,
    initiatedAt: handover.initiatedAt.toISOString(),
    outgoingConfirmedAt: handover.outgoingConfirmedAt.toISOString(),
    incomingConfirmedAt: handover.incomingConfirmedAt?.toISOString() ?? null,
    completedAt: handover.completedAt?.toISOString() ?? null,
  })

  const timeline = [
    ...shifts.flatMap((shift) => {
      const events = [
        {
          id: `${shift.id}:check-in`,
          type: 'check_in',
          timestamp: shift.checkInAt.toISOString(),
          title: 'Shift checked in',
          detail: shift.note ?? 'Shift started.',
        },
      ]

      if (shift.checkOutAt) {
        events.push({
          id: `${shift.id}:check-out`,
          type: 'check_out',
          timestamp: shift.checkOutAt.toISOString(),
          title: 'Shift checked out',
          detail: 'Shift ended.',
        })
      }

      return events
    }),
    ...historicalHandovers.flatMap((handover) => {
      const events = [
        {
          id: `${handover.id}:initiated`,
          type: 'handover_started',
          timestamp: handover.initiatedAt.toISOString(),
          title: `Handover started to ${userNameMap.get(handover.incomingRiderId) ?? 'next rider'}`,
          detail: handover.note ?? 'Outgoing rider confirmed handover.',
        },
      ]

      if (handover.completedAt) {
        events.push({
          id: `${handover.id}:completed`,
          type: 'handover_completed',
          timestamp: handover.completedAt.toISOString(),
          title: `Handover completed with ${userNameMap.get(handover.incomingRiderId) ?? 'next rider'}`,
          detail: 'Both riders confirmed the shift change.',
        })
      }

      return events
    }),
  ].sort((left, right) => right.timestamp.localeCompare(left.timestamp))

  return {
    activeShift: activeShift
      ? {
          ...activeShift,
          checkInAt: activeShift.checkInAt.toISOString(),
          checkOutAt: activeShift.checkOutAt?.toISOString() ?? null,
          createdAt: activeShift.createdAt.toISOString(),
        }
      : null,
    pendingIncomingHandovers: pendingIncomingHandovers.map(serializeHandover),
    pendingOutgoingHandovers: pendingOutgoingHandovers.map(serializeHandover),
    timeline,
  }
}

export const shiftRoutes = new Hono<{ Variables: AppVariables }>()
shiftRoutes.use('*', requireAuth)

shiftRoutes.get('/me', async (c) => {
  const currentUser = c.get('user')
  assert(
    currentUser.role === 'rider',
    new AppError(403, 'forbidden', 'Only riders can view their live shift workspace.'),
  )

  return c.json(await getShiftDashboard(currentUser.id))
})

shiftRoutes.get('/report', async (c) => {
  const currentUser = c.get('user')
  assert(
    currentUser.role === 'admin' || currentUser.role === 'ops',
    new AppError(403, 'forbidden', 'Only admin or ops can view shift reports.'),
  )

  const input = parseInput(shiftReportQuerySchema.parse, {
    start: c.req.query('start'),
    end: c.req.query('end'),
    riderId: c.req.query('rider_id') ?? undefined,
  })
  const startDate = new Date(`${input.start}T00:00:00.000Z`)
  const endDate = new Date(`${input.end}T23:59:59.999Z`)
  const shiftConditions = [
    lte(riderShifts.checkInAt, endDate),
    or(isNull(riderShifts.checkOutAt), gte(riderShifts.checkOutAt, startDate))!,
  ]
  const handoverConditions = [
    gte(riderShiftHandovers.initiatedAt, startDate),
    lte(riderShiftHandovers.initiatedAt, endDate),
  ]

  if (input.riderId) {
    shiftConditions.push(eq(riderShifts.riderId, input.riderId))
    handoverConditions.push(
      or(
        eq(riderShiftHandovers.outgoingRiderId, input.riderId),
        eq(riderShiftHandovers.incomingRiderId, input.riderId),
      )!,
    )
  }

  const [shifts, handovers] = await Promise.all([
    db.query.riderShifts.findMany({
      where: and(...shiftConditions),
      orderBy: [desc(riderShifts.checkInAt)],
      limit: 100,
    }),
    db.query.riderShiftHandovers.findMany({
      where: and(...handoverConditions),
      orderBy: [desc(riderShiftHandovers.initiatedAt)],
      limit: 100,
    }),
  ])

  const relatedUserIds = Array.from(
    new Set(
      [...shifts.map((shift) => shift.riderId), ...handovers.flatMap((handover) => [
        handover.outgoingRiderId,
        handover.incomingRiderId,
        handover.initiatedBy,
        handover.completedBy,
      ])].filter((value): value is string => Boolean(value)),
    ),
  )
  const relatedUsers = relatedUserIds.length
    ? await db
        .select({
          id: users.id,
          name: users.name,
        })
        .from(users)
        .where(inArray(users.id, relatedUserIds))
    : []
  const userNameMap = new Map(relatedUsers.map((item) => [item.id, item.name]))

  const serializedShifts = shifts.map((shift) => ({
    ...shift,
    riderName: userNameMap.get(shift.riderId) ?? null,
    checkInAt: shift.checkInAt.toISOString(),
    checkOutAt: shift.checkOutAt?.toISOString() ?? null,
    createdAt: shift.createdAt.toISOString(),
  }))

  const serializedHandovers = handovers.map((handover) => ({
    id: handover.id,
    outgoingShiftId: handover.outgoingShiftId,
    outgoingRiderId: handover.outgoingRiderId,
    outgoingRiderName: userNameMap.get(handover.outgoingRiderId) ?? null,
    incomingRiderId: handover.incomingRiderId,
    incomingRiderName: userNameMap.get(handover.incomingRiderId) ?? null,
    initiatedBy: userNameMap.get(handover.initiatedBy) ?? null,
    completedBy: handover.completedBy ? userNameMap.get(handover.completedBy) ?? null : null,
    status: handover.status,
    note: handover.note,
    initiatedAt: handover.initiatedAt.toISOString(),
    outgoingConfirmedAt: handover.outgoingConfirmedAt.toISOString(),
    incomingConfirmedAt: handover.incomingConfirmedAt?.toISOString() ?? null,
    completedAt: handover.completedAt?.toISOString() ?? null,
  }))

  const timeline = buildShiftTimeline(serializedShifts, serializedHandovers)

  return c.json({
    shifts: serializedShifts,
    handovers: serializedHandovers,
    timeline,
    totals: computeShiftReportTotals(serializedShifts, serializedHandovers),
  })
})

shiftRoutes.post('/check-in', async (c) => {
  const currentUser = c.get('user')
  assert(
    currentUser.role === 'rider',
    new AppError(403, 'forbidden', 'Only riders can check in to shifts.'),
  )

  const input = await parseJson(c, checkInSchema.parse)
  const [activeShift, pendingIncoming] = await Promise.all([
    getActiveShift(currentUser.id),
    db.query.riderShiftHandovers.findFirst({
      where: and(
        eq(riderShiftHandovers.incomingRiderId, currentUser.id),
        eq(riderShiftHandovers.status, 'pending'),
      ),
    }),
  ])

  assert(!activeShift, new AppError(409, 'shift_active', 'You already have an active shift.'))
  assert(
    !pendingIncoming,
    new AppError(
      409,
      'handover_pending',
      'Accept the pending shift handover instead of starting a separate shift.',
    ),
  )

  await db.insert(riderShifts).values({
    id: crypto.randomUUID(),
    riderId: currentUser.id,
    startedBy: currentUser.id,
    status: 'active',
    note: input.note ?? null,
    checkInAt: new Date(),
    createdAt: new Date(),
  })

  return c.json(await getShiftDashboard(currentUser.id), 201)
})

shiftRoutes.post('/check-out', async (c) => {
  const currentUser = c.get('user')
  assert(
    currentUser.role === 'rider',
    new AppError(403, 'forbidden', 'Only riders can check out of shifts.'),
  )

  const activeShift = await getActiveShift(currentUser.id)
  assert(activeShift, new AppError(409, 'no_active_shift', 'You do not have an active shift.'))

  const pendingOutgoing = await db.query.riderShiftHandovers.findFirst({
    where: and(
      eq(riderShiftHandovers.outgoingShiftId, activeShift.id),
      eq(riderShiftHandovers.status, 'pending'),
    ),
  })

  assert(
    !pendingOutgoing,
    new AppError(
      409,
      'handover_pending',
      'Complete or cancel the pending handover before checking out.',
    ),
  )

  await db
    .update(riderShifts)
    .set({
      status: 'completed',
      endedBy: currentUser.id,
      checkOutAt: new Date(),
    })
    .where(eq(riderShifts.id, activeShift.id))

  return c.json(await getShiftDashboard(currentUser.id))
})

shiftRoutes.post('/handover', async (c) => {
  const currentUser = c.get('user')
  assert(
    currentUser.role === 'rider',
    new AppError(403, 'forbidden', 'Only riders can start shift handovers.'),
  )

  const input = await parseJson(c, startHandoverSchema.parse)
  const [activeShift, incomingRider] = await Promise.all([
    getActiveShift(currentUser.id),
    db.query.users.findFirst({
      where: and(eq(users.id, input.incomingRiderId), eq(users.role, 'rider'), eq(users.active, true)),
    }),
  ])

  assert(activeShift, new AppError(409, 'no_active_shift', 'You do not have an active shift.'))
  assert(incomingRider, new AppError(404, 'not_found', 'Incoming rider not found.'))
  assert(
    incomingRider.id !== currentUser.id,
    new AppError(409, 'same_rider', 'Choose a different rider for the handover.'),
  )

  const [incomingActiveShift, pendingOutgoing] = await Promise.all([
    getActiveShift(incomingRider.id),
    db.query.riderShiftHandovers.findFirst({
      where: and(
        eq(riderShiftHandovers.outgoingShiftId, activeShift.id),
        eq(riderShiftHandovers.status, 'pending'),
      ),
    }),
  ])

  assert(
    !incomingActiveShift,
    new AppError(409, 'incoming_shift_active', 'That rider already has an active shift.'),
  )
  assert(
    !pendingOutgoing,
    new AppError(409, 'handover_pending', 'There is already a pending handover for this shift.'),
  )

  const now = new Date()
  await db.insert(riderShiftHandovers).values({
    id: crypto.randomUUID(),
    outgoingShiftId: activeShift.id,
    outgoingRiderId: currentUser.id,
    incomingRiderId: incomingRider.id,
    initiatedBy: currentUser.id,
    status: 'pending',
    note: input.note ?? null,
    initiatedAt: now,
    outgoingConfirmedAt: now,
  })

  return c.json(await getShiftDashboard(currentUser.id), 201)
})

shiftRoutes.post('/handover/:id/accept', async (c) => {
  const currentUser = c.get('user')
  assert(
    currentUser.role === 'rider',
    new AppError(403, 'forbidden', 'Only riders can accept shift handovers.'),
  )

  const input = await parseJson(c, acceptHandoverSchema.parse)
  const handoverId = c.req.param('id')
  const handover = await db.query.riderShiftHandovers.findFirst({
    where: eq(riderShiftHandovers.id, handoverId),
  })

  assert(handover, new AppError(404, 'not_found', 'Shift handover not found.'))
  assert(
    handover.incomingRiderId === currentUser.id,
    new AppError(403, 'forbidden', 'This handover is not assigned to you.'),
  )
  assert(
    handover.status === 'pending',
    new AppError(409, 'handover_closed', 'This handover is no longer pending.'),
  )

  const [activeShift, outgoingShift] = await Promise.all([
    getActiveShift(currentUser.id),
    db.query.riderShifts.findFirst({
      where: eq(riderShifts.id, handover.outgoingShiftId),
    }),
  ])

  assert(!activeShift, new AppError(409, 'shift_active', 'You already have an active shift.'))
  assert(outgoingShift, new AppError(404, 'not_found', 'Outgoing shift not found.'))
  assert(
    outgoingShift.status === 'active',
    new AppError(409, 'shift_closed', 'The outgoing shift is no longer active.'),
  )

  const now = new Date()

  await db.transaction(async (tx) => {
    await tx
      .update(riderShifts)
      .set({
        status: 'completed',
        endedBy: currentUser.id,
        checkOutAt: now,
      })
      .where(eq(riderShifts.id, outgoingShift.id))

    await tx.insert(riderShifts).values({
      id: crypto.randomUUID(),
      riderId: currentUser.id,
      startedBy: currentUser.id,
      status: 'active',
      note: input.note ?? handover.note ?? null,
      checkInAt: now,
      createdAt: now,
    })

    await tx
      .update(riderShiftHandovers)
      .set({
        status: 'completed',
        completedBy: currentUser.id,
        incomingConfirmedAt: now,
        completedAt: now,
        note: input.note ?? handover.note,
      })
      .where(eq(riderShiftHandovers.id, handover.id))
  })

  return c.json(await getShiftDashboard(currentUser.id))
})
