export type UserRole = 'admin' | 'ops' | 'rider'
export type InvoiceStatus = 'issued' | 'paid' | 'void'

export type WaybillStatus =
  | 'created'
  | 'assigned'
  | 'dispatched'
  | 'delivered'
  | 'failed'
  | 'cancelled'

export type AuthUser = {
  id: string
  name: string
  phone: string
  role: UserRole
  active?: boolean
  defaultClientId?: string | null
  profileImageUrl?: string | null
  profileImageMimeType?: string | null
  vehicleType?: string | null
  vehiclePlateNumber?: string | null
  licenseNumber?: string | null
  address?: string | null
  notes?: string | null
}

export type User = AuthUser & {
  active: boolean
  createdAt?: string
}

export type Client = {
  id: string
  name: string
  contactName: string | null
  contactPhone: string | null
  contactEmail: string | null
  billingAddress: string
  currency: string
  paymentTermsDays: number
  standardDeliveryRateCents: number
  weeklyBandLimit: number | null
  overflowDeliveryRateCents: number | null
  active: boolean
  createdAt: string
}

export type StatusLogEntry = {
  id: string
  fromStatus: string
  toStatus: string
  changedAt: string
  note: string | null
  changedBy: string | null
}

export type ProofOfDelivery = {
  id: string
  waybillId: string
  recipientName: string | null
  signatureFileUrl: string
  signatureMimeType: string
  signatureCapturedAt: string
  completedAt: string
  note: string | null
  createdBy: string
  createdAt: string
}

export type WaybillSummary = {
  id: string
  waybillNumber: string
  orderReference: string
  clientId: string | null
  clientName?: string | null
  entryMode: 'live' | 'historical'
  deliveryProofMethod: 'signature' | 'receipt_photo'
  customerName: string | null
  customerPhone: string
  deliveryAddress: string
  deliveryMethod: string
  itemValueCents: number | null
  receiptImageUrl?: string | null
  receiptImageMimeType?: string | null
  assignedRiderId: string | null
  status: WaybillStatus
  requestedDispatchTime: string | null
  dispatchTime: string | null
  completionTime: string | null
  returnTime: string | null
  updatedAt: string
  riderName?: string | null
}

export type WaybillDetail = WaybillSummary & {
  notes: string | null
  createdAt: string
  createdBy: string
  client: Client | null
  assignedRider: AuthUser | null
  pod: ProofOfDelivery | null
  handovers: Array<{
    id: string
    fromRiderId: string | null
    fromRiderName: string | null
    toRiderId: string
    toRiderName: string | null
    note: string | null
    createdBy: string | null
    handedOverAt: string
  }>
  statusLogs: StatusLogEntry[]
}

export type WeeklyReportItem = {
  waybillId: string
  waybillNumber: string
  orderReference: string
  entryMode: 'live' | 'historical'
  customerName: string | null
  riderId: string | null
  riderName: string | null
  completionTime: string | null
  recipientName: string | null
}

export type WeeklyReportGroup = {
  riderId: string | null
  riderName: string | null
  day: string
  total: number
}

export type WeeklyReportResponse = {
  items: WeeklyReportItem[]
  grouped: WeeklyReportGroup[]
  totals: {
    completedDeliveries: number
    riders: number
  }
}

export type BillingReportItem = {
  waybillId: string
  waybillNumber: string
  orderReference: string
  entryMode: 'live' | 'historical'
  clientId: string | null
  clientName: string | null
  customerName: string | null
  completionTime: string | null
  deliveryChargeCents: number
  pricingTier: 'standard' | 'overflow'
  invoiceId: string | null
  invoiceNumber: string | null
}

export type BillingReportGroup = {
  clientId: string | null
  clientName: string | null
  delivered: number
  totalAmountCents: number
  invoicedAmountCents: number
  uninvoicedAmountCents: number
  uninvoicedCount: number
}

export type BillingReportResponse = {
  items: BillingReportItem[]
  grouped: BillingReportGroup[]
  totals: {
    deliveredWaybills: number
    totalAmountCents: number
    uninvoicedAmountCents: number
    clients: number
  }
}

export type InvoiceSummary = {
  id: string
  invoiceNumber: string
  clientId: string
  clientName: string
  currency: string
  subtotalCents: number
  status: InvoiceStatus
  periodStart: string
  periodEnd: string
  issuedAt: string
  dueAt: string
  paidAt: string | null
  createdAt: string
}

export type InvoiceItem = {
  id: string
  invoiceId: string
  waybillId: string
  entryMode: 'live' | 'historical'
  amountCents: number
  pricingTier: 'standard' | 'overflow'
  createdAt: string
  waybillNumber: string
  orderReference: string
  customerName: string | null
  completionTime: string | null
}

export type InvoiceDetail = {
  id: string
  invoiceNumber: string
  clientId: string
  currency: string
  periodStart: string
  periodEnd: string
  subtotalCents: number
  status: InvoiceStatus
  issuedAt: string
  dueAt: string
  paidAt: string | null
  notes: string | null
  createdBy: string
  createdAt: string
  client: Client
  items: InvoiceItem[]
}

export type ShiftHandover = {
  id: string
  outgoingShiftId: string
  outgoingRiderId: string
  outgoingRiderName: string | null
  incomingRiderId: string
  incomingRiderName: string | null
  initiatedBy: string | null
  completedBy: string | null
  status: 'pending' | 'completed' | 'cancelled'
  note: string | null
  initiatedAt: string
  outgoingConfirmedAt: string
  incomingConfirmedAt: string | null
  completedAt: string | null
}

export type RiderShift = {
  id: string
  riderId: string
  startedBy: string
  endedBy: string | null
  status: 'active' | 'completed'
  note: string | null
  checkInAt: string
  checkOutAt: string | null
  createdAt: string
}

export type ShiftTimelineItem = {
  id: string
  type: 'check_in' | 'check_out' | 'handover_started' | 'handover_completed'
  timestamp: string
  title: string
  detail: string
}

export type ShiftDashboard = {
  activeShift: RiderShift | null
  pendingIncomingHandovers: ShiftHandover[]
  pendingOutgoingHandovers: ShiftHandover[]
  timeline: ShiftTimelineItem[]
}

export type ShiftReportItem = RiderShift & {
  riderName: string | null
}

export type ShiftReportTimelineItem = ShiftTimelineItem & {
  riderId: string
  riderName: string | null
}

export type ShiftReportResponse = {
  shifts: ShiftReportItem[]
  handovers: ShiftHandover[]
  timeline: ShiftReportTimelineItem[]
  totals: {
    activeShifts: number
    shiftCheckIns: number
    shiftCheckOuts: number
    completedHandovers: number
  }
}
