import { describe, expect, test } from 'bun:test'
import {
  isValidGhanaPhone,
  normalizeAddress,
  normalizeGhanaPhone,
  stripPhoneFormatting,
} from './contact'

describe('contact utilities', () => {
  test('normalizes Ghana local and international phone numbers', () => {
    expect(normalizeGhanaPhone('0241234567')).toBe('+233241234567')
    expect(normalizeGhanaPhone('+233241234567')).toBe('+233241234567')
    expect(normalizeGhanaPhone('233241234567')).toBe('+233241234567')
    expect(normalizeGhanaPhone('024 123 4567')).toBe('+233241234567')
  })

  test('rejects invalid Ghana phone numbers', () => {
    expect(normalizeGhanaPhone('241234567')).toBeNull()
    expect(normalizeGhanaPhone('+23324123456')).toBeNull()
    expect(isValidGhanaPhone('055123456')).toBe(false)
  })

  test('strips phone formatting without changing semantics', () => {
    expect(stripPhoneFormatting('+233 (24) 123-4567')).toBe('+233241234567')
    expect(stripPhoneFormatting('024-123-4567')).toBe('0241234567')
  })

  test('normalizes addresses into a clean printable line', () => {
    expect(normalizeAddress('  East Legon  \n American House  ')).toBe(
      'East Legon, American House',
    )
    expect(normalizeAddress('Spintex   Road,   Accra')).toBe('Spintex Road, Accra')
  })
})
