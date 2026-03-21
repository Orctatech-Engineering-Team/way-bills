import { AppError } from './errors'
import type { Context, Next } from 'hono'
import { ZodError } from 'zod'

export async function parseJson<T>(c: Context, parser: (input: unknown) => T) {
  let body: unknown

  try {
    body = await c.req.json()
  } catch {
    throw new AppError(400, 'invalid_json', 'Request body must be valid JSON.')
  }

  return parser(body)
}

export async function withErrorHandling(c: Context, next: Next) {
  try {
    await next()
  } catch (error) {
    if (error instanceof AppError) {
      c.status(error.status as 400 | 401 | 403 | 404 | 409 | 422 | 500 | 502)
      return c.json({
        error: {
          code: error.code,
          message: error.message,
          details: error.details ?? null,
        },
      })
    }

    if (error instanceof ZodError) {
      const details = error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }))

      c.status(422)
      return c.json({
        error: {
          code: 'validation_error',
          message: details[0]?.message ?? 'Request validation failed.',
          details,
        },
      })
    }

    console.error(error)
    c.status(500)
    return c.json({
      error: {
        code: 'internal_error',
        message: 'Something went wrong.',
      },
    })
  }
}
