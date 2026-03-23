export class AppError extends Error {
  status: number
  code: string
  details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'AppError'
    Object.setPrototypeOf(this, new.target.prototype)
    this.status = status
    this.code = code
    this.details = details
  }
}

export function assert(condition: unknown, error: AppError): asserts condition {
  if (!condition) {
    throw error
  }
}
