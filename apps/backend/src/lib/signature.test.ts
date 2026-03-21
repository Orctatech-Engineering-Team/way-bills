import { describe, expect, test } from 'bun:test'
import { decodeSignatureDataUrl } from './signature'

describe('decodeSignatureDataUrl', () => {
  test('accepts png data URLs', () => {
    const result = decodeSignatureDataUrl('data:image/png;base64,AA==')
    expect(result.mimeType).toBe('image/png')
    expect(result.extension).toBe('png')
    expect(Array.from(result.bytes)).toEqual([0])
  })

  test('rejects unsupported payloads', () => {
    expect(() => decodeSignatureDataUrl('hello')).toThrow()
  })
})
