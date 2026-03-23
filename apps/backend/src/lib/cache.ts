export const FRONTEND_ASSET_CACHE_CONTROL = 'public, max-age=31536000, immutable'
export const FRONTEND_HTML_CACHE_CONTROL = 'public, max-age=0, must-revalidate'
export const PUBLIC_MEDIA_CACHE_CONTROL = 'public, max-age=3600, stale-while-revalidate=86400'
export const PUBLIC_DOCUMENT_CACHE_CONTROL = 'public, max-age=300, stale-while-revalidate=86400'
export const PRIVATE_PDF_CACHE_CONTROL = 'private, max-age=300, must-revalidate'

export function pdfResponseHeaders(filename: string) {
  return {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="${filename}"`,
    'Cache-Control': PRIVATE_PDF_CACHE_CONTROL,
  }
}
