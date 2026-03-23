export function stripPhoneFormatting(value: string) {
  const trimmed = value.trim()
  const hasLeadingPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')

  return hasLeadingPlus ? `+${digits}` : digits
}

export function normalizeGhanaPhone(value: string) {
  const sanitized = stripPhoneFormatting(value)

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

export function isValidGhanaPhone(value: string) {
  return normalizeGhanaPhone(value) !== null
}

export function normalizeAddress(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(', ')
}
