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

export type StatusLogEntry = {
  id: string
  fromStatus: string
  toStatus: string
  changedAt: string
  note: string | null
  changedBy: string | null
}

export type ClientSummary = {
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

export type WaybillDetail = {
  id: string
  waybillNumber: string
  orderReference: string
  clientId: string | null
  customerName: string | null
  customerPhone: string
  deliveryAddress: string
  deliveryMethod: string
  itemValueCents: number | null
  notes: string | null
  requestedDispatchTime: string | null
  dispatchTime: string | null
  completionTime: string | null
  returnTime: string | null
  assignedRiderId: string | null
  status: string
  createdBy: string
  createdAt: string
  updatedAt: string
  client: ClientSummary | null
  assignedRider: {
    id: string
    name: string
    phone: string
    role: string
  } | null
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

export type InvoicePdfDetail = {
  id: string
  invoiceNumber: string
  status: 'issued' | 'paid' | 'void'
  currency: string
  periodStart: string
  periodEnd: string
  subtotalCents: number
  issuedAt: string
  dueAt: string
  paidAt: string | null
  notes: string | null
  client: ClientSummary
  items: Array<{
    id: string
    waybillId: string
    waybillNumber: string
    orderReference: string
    customerName: string
    completionTime: string | null
    amountCents: number
    pricingTier: 'standard' | 'overflow'
  }>
}
