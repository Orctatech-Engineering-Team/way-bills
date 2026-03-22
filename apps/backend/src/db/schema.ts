import {
  boolean,
  integer,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

export const userRoleEnum = pgEnum('user_role', ['admin', 'ops', 'rider'])

export const waybillStatusEnum = pgEnum('waybill_status', [
  'created',
  'assigned',
  'dispatched',
  'delivered',
  'failed',
  'cancelled',
])

export const documentTypeEnum = pgEnum('document_type', [
  'waybill_pdf',
  'pod_pdf',
])

export const invoiceStatusEnum = pgEnum('invoice_status', [
  'issued',
  'paid',
  'void',
])

export const riderShiftStatusEnum = pgEnum('rider_shift_status', [
  'active',
  'completed',
])

export const shiftHandoverStatusEnum = pgEnum('shift_handover_status', [
  'pending',
  'completed',
  'cancelled',
])

export const clients = pgTable(
  'clients',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    contactName: text('contact_name'),
    contactPhone: text('contact_phone'),
    contactEmail: text('contact_email'),
    billingAddress: text('billing_address').notNull(),
    currency: text('currency').notNull().default('GHS'),
    paymentTermsDays: integer('payment_terms_days').notNull().default(7),
    standardDeliveryRateCents: integer('default_rate_cents').notNull().default(0),
    weeklyBandLimit: integer('weekly_band_limit'),
    overflowDeliveryRateCents: integer('overflow_delivery_rate_cents'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    nameUnique: uniqueIndex('clients_name_unique').on(table.name),
    activeIdx: index('clients_active_idx').on(table.active),
  }),
)

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    phone: text('phone').notNull(),
    profileImageUrl: text('profile_image_url'),
    profileImageMimeType: text('profile_image_mime_type'),
    defaultClientId: text('default_client_id').references(() => clients.id, {
      onDelete: 'set null',
    }),
    vehicleType: text('vehicle_type'),
    vehiclePlateNumber: text('vehicle_plate_number'),
    licenseNumber: text('license_number'),
    address: text('address'),
    notes: text('notes'),
    role: userRoleEnum('role').notNull(),
    passwordHash: text('password_hash').notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    phoneUnique: uniqueIndex('users_phone_unique').on(table.phone),
    roleIdx: index('users_role_idx').on(table.role),
  }),
)

export const waybills = pgTable(
  'waybills',
  {
    id: text('id').primaryKey(),
    waybillNumber: text('waybill_number').notNull(),
    orderReference: text('order_reference').notNull(),
    clientId: text('client_id').references(() => clients.id, {
      onDelete: 'set null',
    }),
    customerName: text('customer_name'),
    customerPhone: text('customer_phone').notNull(),
    deliveryAddress: text('delivery_address').notNull(),
    deliveryMethod: text('delivery_method').notNull().default('cash'),
    entryMode: text('entry_mode').notNull().default('live'),
    deliveryProofMethod: text('delivery_proof_method')
      .notNull()
      .default('signature'),
    billableAmountCents: integer('billable_amount_cents').notNull().default(0),
    itemValueCents: integer('item_value_cents'),
    receiptImageUrl: text('receipt_image_url'),
    receiptImageMimeType: text('receipt_image_mime_type'),
    notes: text('notes'),
    requestedDispatchTime: timestamp('requested_dispatch_time', {
      withTimezone: true,
    }),
    dispatchTime: timestamp('dispatch_time', { withTimezone: true }),
    completionTime: timestamp('completion_time', { withTimezone: true }),
    returnTime: timestamp('return_time', { withTimezone: true }),
    assignedRiderId: text('assigned_rider_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    status: waybillStatusEnum('status').notNull().default('created'),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    waybillNumberUnique: uniqueIndex('waybills_waybill_number_unique').on(
      table.waybillNumber,
    ),
    clientIdx: index('waybills_client_id_idx').on(table.clientId),
    statusIdx: index('waybills_status_idx').on(table.status),
    riderIdx: index('waybills_assigned_rider_idx').on(table.assignedRiderId),
    completionIdx: index('waybills_completion_time_idx').on(
      table.completionTime,
    ),
    createdIdx: index('waybills_created_at_idx').on(table.createdAt),
  }),
)

export const riderShifts = pgTable(
  'rider_shifts',
  {
    id: text('id').primaryKey(),
    riderId: text('rider_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    startedBy: text('started_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    endedBy: text('ended_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    status: riderShiftStatusEnum('status').notNull().default('active'),
    note: text('note'),
    checkInAt: timestamp('check_in_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    checkOutAt: timestamp('check_out_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    riderIdx: index('rider_shifts_rider_id_idx').on(table.riderId),
    statusIdx: index('rider_shifts_status_idx').on(table.status),
    checkInIdx: index('rider_shifts_check_in_at_idx').on(table.checkInAt),
  }),
)

export const riderShiftHandovers = pgTable(
  'rider_shift_handovers',
  {
    id: text('id').primaryKey(),
    outgoingShiftId: text('outgoing_shift_id')
      .notNull()
      .references(() => riderShifts.id, { onDelete: 'cascade' }),
    outgoingRiderId: text('outgoing_rider_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    incomingRiderId: text('incoming_rider_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    initiatedBy: text('initiated_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    completedBy: text('completed_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    status: shiftHandoverStatusEnum('status').notNull().default('pending'),
    note: text('note'),
    initiatedAt: timestamp('initiated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    outgoingConfirmedAt: timestamp('outgoing_confirmed_at', {
      withTimezone: true,
    }).notNull(),
    incomingConfirmedAt: timestamp('incoming_confirmed_at', {
      withTimezone: true,
    }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => ({
    outgoingShiftIdx: index('rider_shift_handovers_outgoing_shift_id_idx').on(
      table.outgoingShiftId,
    ),
    outgoingRiderIdx: index('rider_shift_handovers_outgoing_rider_id_idx').on(
      table.outgoingRiderId,
    ),
    incomingRiderIdx: index('rider_shift_handovers_incoming_rider_id_idx').on(
      table.incomingRiderId,
    ),
    initiatedIdx: index('rider_shift_handovers_initiated_at_idx').on(
      table.initiatedAt,
    ),
  }),
)

export const waybillHandovers = pgTable(
  'waybill_handovers',
  {
    id: text('id').primaryKey(),
    waybillId: text('waybill_id')
      .notNull()
      .references(() => waybills.id, { onDelete: 'cascade' }),
    fromRiderId: text('from_rider_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    toRiderId: text('to_rider_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    note: text('note'),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    handedOverAt: timestamp('handed_over_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    waybillIdx: index('waybill_handovers_waybill_id_idx').on(table.waybillId),
    handoverTimeIdx: index('waybill_handovers_handed_over_at_idx').on(
      table.handedOverAt,
    ),
  }),
)

export const proofOfDeliveries = pgTable(
  'proof_of_deliveries',
  {
    id: text('id').primaryKey(),
    waybillId: text('waybill_id')
      .notNull()
      .references(() => waybills.id, { onDelete: 'cascade' }),
    recipientName: text('recipient_name'),
    signatureFileUrl: text('signature_file_url').notNull(),
    signatureMimeType: text('signature_mime_type').notNull(),
    signatureCapturedAt: timestamp('signature_captured_at', {
      withTimezone: true,
    }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }).notNull(),
    note: text('note'),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    waybillUnique: uniqueIndex('proof_of_deliveries_waybill_id_unique').on(
      table.waybillId,
    ),
  }),
)

export const statusLogs = pgTable(
  'status_logs',
  {
    id: text('id').primaryKey(),
    waybillId: text('waybill_id')
      .notNull()
      .references(() => waybills.id, { onDelete: 'cascade' }),
    fromStatus: text('from_status').notNull(),
    toStatus: text('to_status').notNull(),
    changedBy: text('changed_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    changedAt: timestamp('changed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    note: text('note'),
  },
  (table) => ({
    waybillIdx: index('status_logs_waybill_id_idx').on(table.waybillId),
    changedIdx: index('status_logs_changed_at_idx').on(table.changedAt),
  }),
)

export const documents = pgTable(
  'documents',
  {
    id: text('id').primaryKey(),
    waybillId: text('waybill_id')
      .notNull()
      .references(() => waybills.id, { onDelete: 'cascade' }),
    type: documentTypeEnum('type').notNull(),
    fileUrl: text('file_url').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    waybillIdx: index('documents_waybill_id_idx').on(table.waybillId),
    waybillTypeUnique: uniqueIndex('documents_waybill_type_unique').on(
      table.waybillId,
      table.type,
    ),
  }),
)

export const invoices = pgTable(
  'invoices',
  {
    id: text('id').primaryKey(),
    invoiceNumber: text('invoice_number').notNull(),
    clientId: text('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'restrict' }),
    currency: text('currency').notNull().default('GHS'),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    subtotalCents: integer('subtotal_cents').notNull().default(0),
    status: invoiceStatusEnum('status').notNull().default('issued'),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    notes: text('notes'),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    invoiceNumberUnique: uniqueIndex('invoices_invoice_number_unique').on(
      table.invoiceNumber,
    ),
    clientIdx: index('invoices_client_id_idx').on(table.clientId),
    statusIdx: index('invoices_status_idx').on(table.status),
    createdIdx: index('invoices_created_at_idx').on(table.createdAt),
  }),
)

export const invoiceItems = pgTable(
  'invoice_items',
  {
    id: text('id').primaryKey(),
    invoiceId: text('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    waybillId: text('waybill_id')
      .notNull()
      .references(() => waybills.id, { onDelete: 'restrict' }),
    amountCents: integer('amount_cents').notNull().default(0),
    pricingTier: text('pricing_tier').notNull().default('standard'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    invoiceIdx: index('invoice_items_invoice_id_idx').on(table.invoiceId),
    waybillUnique: uniqueIndex('invoice_items_waybill_id_unique').on(table.waybillId),
  }),
)

export type UserRole = (typeof userRoleEnum.enumValues)[number]
export type WaybillStatus = (typeof waybillStatusEnum.enumValues)[number]
export type DocumentType = (typeof documentTypeEnum.enumValues)[number]
export type InvoiceStatus = (typeof invoiceStatusEnum.enumValues)[number]
