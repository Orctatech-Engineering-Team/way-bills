import { ApiError } from './api'

export function errorMessageFrom(caughtError: unknown, fallback: string) {
  if (caughtError instanceof ApiError) {
    if (typeof caughtError.message === 'string' && caughtError.message.trim()) {
      return caughtError.message
    }

    if (Array.isArray(caughtError.details) && caughtError.details.length > 0) {
      const firstDetail = caughtError.details[0]

      if (
        typeof firstDetail === 'object' &&
        firstDetail !== null &&
        'message' in firstDetail &&
        typeof firstDetail.message === 'string'
      ) {
        return firstDetail.message
      }
    }

    if (
      caughtError.details &&
      typeof caughtError.details === 'object' &&
      'detail' in caughtError.details &&
      typeof caughtError.details.detail === 'string' &&
      caughtError.details.detail.trim()
    ) {
      return caughtError.details.detail
    }

    return fallback
  }

  if (caughtError instanceof Error && caughtError.message) {
    return caughtError.message
  }

  return fallback
}
