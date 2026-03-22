import type { WaybillStatus } from '../lib/types'
import { statusLabel } from '../lib/utils'

const tones: Record<WaybillStatus, string> = {
  created: 'border-[rgba(15,23,42,0.12)] bg-transparent text-[var(--surface-muted)]',
  assigned: 'border-[rgba(20,44,101,0.18)] bg-transparent text-[var(--secondary)]',
  dispatched: 'border-[rgba(20,44,101,0.22)] bg-transparent text-[var(--secondary)]',
  delivered: 'border-[rgba(23,58,42,0.2)] bg-transparent text-[#173a2a]',
  failed: 'border-[rgba(180,35,24,0.18)] bg-transparent text-[#b42318]',
  cancelled: 'border-[rgba(107,107,107,0.18)] bg-transparent text-[var(--surface-muted)]',
}

export function StatusBadge({ status }: { status: WaybillStatus }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.16em] ${tones[status]}`}
    >
      {statusLabel(status)}
    </span>
  )
}
