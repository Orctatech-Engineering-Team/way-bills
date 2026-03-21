import type { WaybillStatus } from '../lib/types'
import { statusLabel } from '../lib/utils'

const tones: Record<WaybillStatus, string> = {
  created: 'bg-[rgba(15,23,42,0.06)] text-[var(--surface-muted)]',
  assigned: 'bg-[rgba(20,44,101,0.08)] text-[var(--secondary)]',
  dispatched: 'bg-[rgba(20,44,101,0.14)] text-[var(--secondary)]',
  delivered: 'bg-[rgba(23,58,42,0.1)] text-[#173a2a]',
  failed: 'bg-[rgba(180,35,24,0.08)] text-[#b42318]',
  cancelled: 'bg-[rgba(107,107,107,0.12)] text-[var(--surface-muted)]',
}

export function StatusBadge({ status }: { status: WaybillStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1.5 text-[0.7rem] font-bold uppercase tracking-[0.16em] ${tones[status]}`}
    >
      {statusLabel(status)}
    </span>
  )
}
