import { describe, expect, test } from 'bun:test'
import {
  FRONTEND_ASSET_CACHE_CONTROL,
  FRONTEND_HTML_CACHE_CONTROL,
  PRIVATE_PDF_CACHE_CONTROL,
  PUBLIC_DOCUMENT_CACHE_CONTROL,
  PUBLIC_MEDIA_CACHE_CONTROL,
  pdfResponseHeaders,
} from './cache'

describe('cache policies', () => {
  test('defines stable frontend cache policies', () => {
    expect(FRONTEND_ASSET_CACHE_CONTROL).toBe('public, max-age=31536000, immutable')
    expect(FRONTEND_HTML_CACHE_CONTROL).toBe('public, max-age=0, must-revalidate')
  })

  test('defines public object storage cache policies', () => {
    expect(PUBLIC_MEDIA_CACHE_CONTROL).toBe('public, max-age=3600, stale-while-revalidate=86400')
    expect(PUBLIC_DOCUMENT_CACHE_CONTROL).toBe(
      'public, max-age=300, stale-while-revalidate=86400',
    )
  })

  test('builds private inline pdf headers', () => {
    expect(pdfResponseHeaders('WB-20260322-001.pdf')).toEqual({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="WB-20260322-001.pdf"',
      'Cache-Control': PRIVATE_PDF_CACHE_CONTROL,
    })
  })
})
