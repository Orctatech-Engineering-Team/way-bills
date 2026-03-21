import { ApiError } from './api'

export function errorMessageFrom(caughtError: unknown, fallback: string) {
  if (caughtError instanceof ApiError) {
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

    return caughtError.message
  }

  if (caughtError instanceof Error && caughtError.message) {
    return caughtError.message
  }

  return fallback
}
