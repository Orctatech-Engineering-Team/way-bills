export function sanitizeGhanaPhoneInput(value: string) {
  const trimmed = value.trimStart()
  const hasLeadingPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')

  return hasLeadingPlus ? `+${digits}` : digits
}

export function normalizeGhanaPhone(value: string) {
  const sanitized = sanitizeGhanaPhoneInput(value)

  if (/^0\d{9}$/.test(sanitized)) {
    return `+233${sanitized.slice(1)}`
  }

  if (/^\+233\d{9}$/.test(sanitized)) {
    return sanitized
  }

  if (/^233\d{9}$/.test(sanitized)) {
    return `+${sanitized}`
  }

  return null
}

export function formatGhanaPhoneForDisplay(value: string | null | undefined) {
  if (!value) {
    return 'Not set'
  }

  const normalized = normalizeGhanaPhone(value)
  if (!normalized) {
    return value
  }

  const localPart = normalized.slice(4)
  return `+233 ${localPart.slice(0, 2)} ${localPart.slice(2, 5)} ${localPart.slice(5)}`
}

export function normalizeAddressInput(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(', ')
}
