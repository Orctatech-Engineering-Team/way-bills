import { describe, expect, test } from 'bun:test'
import { Hono } from 'hono'
import { z } from 'zod'
import { AppError } from './errors'
import { handleError, parseJson } from './http'

describe('http error handling', () => {
  test('returns AppError details through Hono onError', async () => {
    const app = new Hono()

    app.onError(handleError)
    app.get('/shift-check', () => {
      throw new AppError(
        409,
        'shift_required',
        'Check in to your shift before updating deliveries.',
      )
    })

    const response = await app.request('/shift-check')

    expect(response.status).toBe(409)
    expect(response.json()).resolves.toEqual({
      error: {
        code: 'shift_required',
        message: 'Check in to your shift before updating deliveries.',
        details: null,
      },
    })
  })

  test('normalizes Zod validation errors', async () => {
    const app = new Hono()

    app.onError(handleError)
    app.post('/validation', async (c) => {
      const body = await parseJson(c, (input) =>
        z
          .object({
            customerPhone: z.string().min(1, 'Customer phone is required.'),
          })
          .parse(input),
      )

      return c.json(body)
    })

    const response = await app.request('/validation', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ customerPhone: '' }),
    })

    expect(response.status).toBe(422)
    expect(response.json()).resolves.toEqual({
      error: {
        code: 'validation_error',
        message: 'Customer phone is required.',
        details: [
          {
            path: 'customerPhone',
            message: 'Customer phone is required.',
          },
        ],
      },
    })
  })

  test('normalizes schema mismatch database errors', async () => {
    const app = new Hono()

    app.onError(handleError)
    app.get('/database', () => {
      const error = new Error('column waybills.entry_mode does not exist') as Error & {
        code?: string
        column_name?: string
      }
      error.code = '42703'
      error.column_name = 'entry_mode'
      throw error
    })

    const response = await app.request('/database')

    expect(response.status).toBe(500)
    expect(response.json()).resolves.toEqual({
      error: {
        code: 'schema_mismatch',
        message:
          'The server schema is out of date. Run the latest database migrations and try again.',
        details: {
          code: '42703',
          detail: null,
          hint: null,
          table: null,
          column: 'entry_mode',
          constraint: null,
        },
      },
    })
  })
})
