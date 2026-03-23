import { describe, expect, test } from 'vitest'
import {
  formatGhanaPhoneForInput,
  formatGhanaPhoneForDisplay,
  normalizeAddressInput,
  normalizeGhanaPhone,
  sanitizeGhanaPhoneInput,
} from './contact'

describe('contact utilities', () => {
  test('sanitizes and normalizes Ghana phone numbers', () => {
    expect(sanitizeGhanaPhoneInput('+233 (24) 123-4567')).toBe('+233241234567')
    expect(normalizeGhanaPhone('0241234567')).toBe('+233241234567')
    expect(normalizeGhanaPhone('233241234567')).toBe('+233241234567')
    expect(normalizeGhanaPhone('+233241234567')).toBe('+233241234567')
  })

  test('formats Ghana phone numbers for display', () => {
    expect(formatGhanaPhoneForDisplay('0241234567')).toBe('+233 24 123 4567')
    expect(formatGhanaPhoneForDisplay('+233241234567')).toBe('+233 24 123 4567')
    expect(formatGhanaPhoneForDisplay(null)).toBe('Not set')
  })

  test('formats Ghana phone numbers for input fields', () => {
    expect(formatGhanaPhoneForInput('0241234567')).toBe('+233 24 123 4567')
    expect(formatGhanaPhoneForInput('+233241234567')).toBe('+233 24 123 4567')
    expect(formatGhanaPhoneForInput('02412')).toBe('02412')
  })

  test('normalizes address input into a clean single line', () => {
    expect(normalizeAddressInput(' East Legon   \n American House ')).toBe(
      'East Legon, American House',
    )
    expect(normalizeAddressInput('Spintex   Road,   Accra')).toBe('Spintex Road, Accra')
  })
})
