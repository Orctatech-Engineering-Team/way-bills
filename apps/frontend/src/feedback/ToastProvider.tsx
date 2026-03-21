import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, X } from 'lucide-react'

type ToastTone = 'success' | 'warning' | 'error'

type ToastInput = {
  title?: string
  message: string
  tone?: ToastTone
  durationMs?: number
}

type ToastRecord = ToastInput & {
  id: string
  tone: ToastTone
}

type ToastContextValue = {
  showToast: (toast: ToastInput) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

function iconForTone(tone: ToastTone) {
  if (tone === 'success') {
    return <CheckCircle2 size={18} strokeWidth={2.2} />
  }

  if (tone === 'warning') {
    return <AlertTriangle size={18} strokeWidth={2.2} />
  }

  return <AlertCircle size={18} strokeWidth={2.2} />
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastRecord[]>([])
  const timeouts = useRef(new Map<string, number>())

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast(toast) {
        const id = crypto.randomUUID()
        const record: ToastRecord = {
          id,
          title: toast.title,
          message: toast.message,
          tone: toast.tone ?? 'error',
          durationMs: toast.durationMs,
        }

        setItems((current) => [...current, record])

        const timeout = window.setTimeout(() => {
          setItems((current) => current.filter((item) => item.id !== id))
          timeouts.current.delete(id)
        }, toast.durationMs ?? 4200)

        timeouts.current.set(id, timeout)
      },
    }),
    [],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {items.map((item) => (
          <div key={item.id} className={`toast-card ${item.tone}`} role="status">
            <div className="toast-icon">{iconForTone(item.tone)}</div>
            <div className="toast-copy">
              {item.title ? <p className="toast-title">{item.title}</p> : null}
              <p className="toast-message">{item.message}</p>
            </div>
            <button
              type="button"
              className="toast-dismiss"
              onClick={() => {
                const timeout = timeouts.current.get(item.id)
                if (timeout) {
                  window.clearTimeout(timeout)
                  timeouts.current.delete(item.id)
                }
                setItems((current) => current.filter((entry) => entry.id !== item.id))
              }}
              aria-label="Dismiss notification"
            >
              <X size={16} strokeWidth={2.2} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error('useToast must be used inside ToastProvider.')
  }

  return context
}
