import { config } from '../config'
import { AppError } from './errors'
import type { Context } from 'hono'
import { ZodError } from 'zod'

export async function parseJson<T>(c: Context, parser: (input: unknown) => T) {
  let body: unknown

  try {
    body = await c.req.json()
  } catch {
    throw new AppError(400, 'invalid_json', 'Request body must be valid JSON.')
  }

  return parseInput(parser, body)
}

export function parseInput<T>(parser: (input: unknown) => T, input: unknown) {
  try {
    return parser(input)
  } catch (error) {
    if (isZodErrorLike(error)) {
      const details = error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }))

      throw new AppError(
        422,
        'validation_error',
        details[0]?.message ?? 'Request validation failed.',
        details,
      )
    }

    throw error
  }
}

export function handleError(error: unknown, c: Context) {
  const resolvedError = unwrapErrorCause(error)

  if (isAppErrorLike(resolvedError)) {
    c.status(resolvedError.status as 400 | 401 | 403 | 404 | 409 | 422 | 500 | 502)
    return c.json({
      error: {
        code: resolvedError.code,
        message: resolvedError.message,
        details: resolvedError.details ?? null,
      },
    })
  }

  if (isZodErrorLike(resolvedError)) {
    const details = resolvedError.issues.map((issue) => ({
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

  if (isPostgresLikeError(resolvedError)) {
    const normalized = normalizePostgresLikeError(resolvedError)

    c.status(normalized.status)
    return c.json({
      error: {
        code: normalized.code,
        message: normalized.message,
        details: normalized.details ?? null,
      },
    })
  }

  console.error(error)
  c.status(500)
  return c.json({
    error: {
      code: 'internal_error',
      message:
        resolvedError instanceof Error && resolvedError.message
          ? resolvedError.message
          : 'Something went wrong.',
      details:
        config.appEnv === 'production'
          ? null
          : resolvedError instanceof Error
            ? {
                name: resolvedError.name,
                stack: resolvedError.stack ?? null,
              }
            : null,
    },
  })
}

function isAppErrorLike(error: unknown): error is AppError {
  return (
    error instanceof AppError ||
    (typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      'code' in error &&
      'message' in error &&
      typeof (error as { status?: unknown }).status === 'number' &&
      typeof (error as { code?: unknown }).code === 'string' &&
      typeof (error as { message?: unknown }).message === 'string')
  )
}

type ZodErrorLike = {
  issues: Array<{
    path: Array<string | number>
    message: string
  }>
}

function isZodErrorLike(error: unknown): error is ZodErrorLike {
  return (
    error instanceof ZodError ||
    (typeof error === 'object' &&
      error !== null &&
      'issues' in error &&
      Array.isArray((error as { issues?: unknown }).issues))
  )
}

type PostgresLikeError = {
  code?: string
  message?: string
  detail?: string
  hint?: string
  table_name?: string
  column_name?: string
  constraint_name?: string
}

function isPostgresLikeError(error: unknown): error is PostgresLikeError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    typeof (error as { code?: unknown }).code === 'string' &&
    typeof (error as { message?: unknown }).message === 'string'
  )
}

function normalizePostgresLikeError(error: PostgresLikeError) {
  const details = {
    code: error.code ?? null,
    detail: error.detail ?? null,
    hint: error.hint ?? null,
    table: error.table_name ?? null,
    column: error.column_name ?? null,
    constraint: error.constraint_name ?? null,
  }

  switch (error.code) {
    case '23505':
      return {
        status: 409 as const,
        code: 'duplicate_record',
        message: error.detail ?? 'That record already exists.',
        details,
      }
    case '23503':
      return {
        status: 409 as const,
        code: 'related_record_missing',
        message: error.detail ?? 'This action references a missing related record.',
        details,
      }
    case '23502':
      return {
        status: 422 as const,
        code: 'missing_required_value',
        message:
          error.column_name
            ? `${error.column_name} is required.`
            : error.message ?? 'A required value is missing.',
        details,
      }
    case '22P02':
      return {
        status: 422 as const,
        code: 'invalid_value',
        message: error.message ?? 'One of the submitted values is invalid.',
        details,
      }
    case '42703':
      return {
        status: 500 as const,
        code: 'schema_mismatch',
        message:
          'The server schema is out of date. Run the latest database migrations and try again.',
        details,
      }
    default:
      return {
        status: 500 as const,
        code: 'database_error',
        message: error.message ?? 'A database error occurred.',
        details,
      }
  }
}

function unwrapErrorCause(error: unknown) {
  let current = error
  let depth = 0

  while (
    depth < 5 &&
    current &&
    typeof current === 'object' &&
    'cause' in current &&
    (current as { cause?: unknown }).cause
  ) {
    const next = (current as { cause?: unknown }).cause
    if (!next || next === current) {
      break
    }

    current = next
    depth += 1
  }

  return current
}
