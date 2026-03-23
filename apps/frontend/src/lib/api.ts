import type {
  AuthUser,
  BillingReportResponse,
  Client,
  InvoiceDetail,
  InvoiceSummary,
  ProofOfDelivery,
  ShiftDashboard,
  ShiftReportResponse,
  User,
  WaybillDetail,
  WaybillSummary,
  WeeklyReportResponse,
} from './types'

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001'

export class ApiError extends Error {
  status: number
  code?: string
  details?: unknown

  constructor(status: number, message: string, details?: unknown, code?: string) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      ...init,
    })
  } catch (error) {
    throw new ApiError(
      0,
      'Unable to reach the server. Check your connection or confirm the backend is running.',
      error instanceof Error ? { cause: error.message } : undefined,
      'network_error',
    )
  }

  const hasBody = response.status !== 204
  const rawBody = hasBody ? await response.text().catch(() => '') : ''
  let payload: any = null

  if (rawBody) {
    try {
      payload = JSON.parse(rawBody)
    } catch {
      payload = null
    }
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.error?.message ??
        (rawBody || `${response.status} ${response.statusText || 'Request failed.'}`),
      payload?.error?.details,
      payload?.error?.code,
    )
  }

  return payload as T
}

export const api = {
  async login(input: { phone: string; password: string }) {
    return request<{ user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },
  async logout() {
    return request<{ success: boolean }>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({}),
    })
  },
  async getCurrentUser() {
    return request<{ user: AuthUser | null }>('/auth/me')
  },
  async listUsers(params?: { role?: string; active?: boolean }) {
    const search = new URLSearchParams()
    if (params?.role) search.set('role', params.role)
    if (params?.active !== undefined) search.set('active', String(params.active))
    const suffix = search.size > 0 ? `?${search.toString()}` : ''
    return request<{ items: User[]; total: number }>(`/users${suffix}`)
  },
  async createUser(input: {
    name: string
    phone: string
    role: 'admin' | 'ops' | 'rider'
    password: string
    active?: boolean
    profileImageDataUrl?: string
    defaultClientId?: string | null
    vehicleType?: string | null
    vehiclePlateNumber?: string | null
    licenseNumber?: string | null
    address?: string | null
    notes?: string | null
  }) {
    return request<{ user: User }>('/users', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },
  async updateUser(
    id: string,
    input: Partial<User> & {
      password?: string
      profileImageDataUrl?: string | null
      defaultClientId?: string | null
    },
  ) {
    return request<{ user: User }>(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
  },
  async listWaybills(params?: {
    status?: string
    search?: string
    riderId?: string
    entryMode?: 'live' | 'historical'
  }) {
    const search = new URLSearchParams()
    if (params?.status) search.set('status', params.status)
    if (params?.search) search.set('search', params.search)
    if (params?.riderId) search.set('rider_id', params.riderId)
    if (params?.entryMode) search.set('entry_mode', params.entryMode)
    const suffix = search.size > 0 ? `?${search.toString()}` : ''
    return request<{ items: WaybillSummary[]; total: number }>(`/waybills${suffix}`)
  },
  async getWaybill(id: string) {
    return request<{ waybill: WaybillDetail }>(`/waybills/${id}`)
  },
  async createWaybill(input: {
    orderReference: string
    clientId: string
    entryMode?: 'live' | 'historical'
    customerName?: string | null
    customerPhone: string
    deliveryAddress: string
    deliveryMethod: 'cash' | 'momo' | 'card' | 'bank_transfer' | 'other'
    itemValueCents?: number | null
    receiptImageDataUrl?: string | null
    dispatchTime?: string | null
    completionTime?: string | null
    notes?: string | null
  }) {
    return request<{ waybill: WaybillDetail }>('/waybills', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },
  async batchDispatchWaybills(ids: string[]) {
    return request<{ success: boolean; count: number }>('/waybills/batch-dispatch', {
      method: 'PATCH',
      body: JSON.stringify({ ids }),
    })
  },
  async batchLogWaybillReturnTime(ids: string[], returnTime?: string) {
    return request<{ success: boolean; count: number; returnTime: string }>(
      '/waybills/batch-return-time',
      {
        method: 'PATCH',
        body: JSON.stringify({
          ids,
          returnTime,
        }),
      },
    )
  },
  async handoverWaybill(id: string, input: { riderId: string; note?: string | null }) {
    return request<{ waybill: WaybillDetail }>(`/waybills/${id}/handover`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
  },
  async assignWaybill(id: string, riderId: string, note?: string) {
    return request<{ waybill: WaybillDetail }>(`/waybills/${id}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ riderId, note }),
    })
  },
  async updateWaybillStatus(id: string, status: string, note?: string) {
    return request<{ waybill: WaybillDetail }>(`/waybills/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, note }),
    })
  },
  async updateWaybillReceipt(
    id: string,
    input: { receiptImageDataUrl: string | null },
  ) {
    return request<{ waybill: WaybillDetail }>(`/waybills/${id}/receipt`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
  },
  async createPod(
    id: string,
    input: { recipientName?: string | null; signatureDataUrl: string; note?: string | null },
  ) {
    return request<{ pod: ProofOfDelivery }>(`/waybills/${id}/pod`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },
  async getMyShiftDashboard() {
    return request<ShiftDashboard>('/shifts/me')
  },
  async getShiftReport(input: { start: string; end: string; riderId?: string }) {
    const search = new URLSearchParams({
      start: input.start,
      end: input.end,
    })
    if (input.riderId) search.set('rider_id', input.riderId)
    return request<ShiftReportResponse>(`/shifts/report?${search.toString()}`)
  },
  async checkInShift(input?: { note?: string | null }) {
    return request<ShiftDashboard>('/shifts/check-in', {
      method: 'POST',
      body: JSON.stringify(input ?? {}),
    })
  },
  async checkOutShift() {
    return request<ShiftDashboard>('/shifts/check-out', {
      method: 'POST',
      body: JSON.stringify({}),
    })
  },
  async startShiftHandover(input: { incomingRiderId: string; note?: string | null }) {
    return request<ShiftDashboard>('/shifts/handover', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },
  async acceptShiftHandover(id: string, input?: { note?: string | null }) {
    return request<ShiftDashboard>(`/shifts/handover/${id}/accept`, {
      method: 'POST',
      body: JSON.stringify(input ?? {}),
    })
  },
  async getWeeklyReport(input: {
    start: string
    end: string
    riderId?: string
    entryMode?: 'live' | 'historical'
  }) {
    const search = new URLSearchParams({
      start: input.start,
      end: input.end,
    })
    if (input.riderId) search.set('rider_id', input.riderId)
    if (input.entryMode) search.set('entry_mode', input.entryMode)
    return request<WeeklyReportResponse>(`/reports/weekly?${search.toString()}`)
  },
  async listClients(params?: { active?: boolean }) {
    const search = new URLSearchParams()
    if (params?.active !== undefined) search.set('active', String(params.active))
    const suffix = search.size > 0 ? `?${search.toString()}` : ''
    return request<{ items: Client[]; total: number }>(`/clients${suffix}`)
  },
  async createClient(input: {
    name: string
    contactName?: string | null
    contactPhone?: string | null
    contactEmail?: string | null
    billingAddress: string
    currency?: string
    paymentTermsDays?: number
    standardDeliveryRateCents?: number
    weeklyBandLimit?: number | null
    overflowDeliveryRateCents?: number | null
    active?: boolean
  }) {
    return request<{ client: Client }>('/clients', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },
  async updateClient(id: string, input: Partial<Client>) {
    return request<{ client: Client }>(`/clients/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
  },
  async listInvoices(params?: { clientId?: string; status?: string }) {
    const search = new URLSearchParams()
    if (params?.clientId) search.set('client_id', params.clientId)
    if (params?.status) search.set('status', params.status)
    const suffix = search.size > 0 ? `?${search.toString()}` : ''
    return request<{ items: InvoiceSummary[]; total: number }>(`/invoices${suffix}`)
  },
  async getInvoice(id: string) {
    return request<{ invoice: InvoiceDetail }>(`/invoices/${id}`)
  },
  async createInvoice(input: {
    clientId: string
    start: string
    end: string
    dueDate?: string
    notes?: string | null
  }) {
    return request<{ invoice: InvoiceDetail }>('/invoices', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },
  async updateInvoiceStatus(id: string, status: 'paid' | 'void') {
    return request<{ invoice: InvoiceDetail }>(`/invoices/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  },
  async getBillingReport(input: {
    start: string
    end: string
    clientId?: string
    invoiceStatus?: 'uninvoiced'
    entryMode?: 'live' | 'historical'
  }) {
    const search = new URLSearchParams({
      start: input.start,
      end: input.end,
    })
    if (input.clientId) search.set('client_id', input.clientId)
    if (input.invoiceStatus) search.set('invoice_status', input.invoiceStatus)
    if (input.entryMode) search.set('entry_mode', input.entryMode)
    return request<BillingReportResponse>(`/reports/billing-summary?${search.toString()}`)
  },
}

export function waybillPdfUrl(waybillId: string) {
  return `${API_BASE_URL}/waybills/${waybillId}/pdf`
}

export function podPdfUrl(waybillId: string) {
  return `${API_BASE_URL}/waybills/${waybillId}/pod/pdf`
}

export function invoicePdfUrl(invoiceId: string) {
  return `${API_BASE_URL}/invoices/${invoiceId}/pdf`
}
