import { describe, expect, test } from 'bun:test'
import {
  assertTransition,
  canTransition,
  generateWaybillNumber,
} from './waybills'

describe('waybill state machine', () => {
  test('allows only declared transitions', () => {
    expect(canTransition('created', 'assigned')).toBe(true)
    expect(canTransition('assigned', 'dispatched')).toBe(true)
    expect(canTransition('dispatched', 'delivered')).toBe(true)
    expect(canTransition('created', 'dispatched')).toBe(false)
  })

  test('throws on invalid transitions', () => {
    expect(() => assertTransition('created', 'dispatched')).toThrow()
  })

  test('generates stable formatted waybill numbers', () => {
    expect(generateWaybillNumber(new Date('2025-03-20T12:00:00Z'), 7)).toBe(
      'WB-20250320-7',
    )
  })
})
