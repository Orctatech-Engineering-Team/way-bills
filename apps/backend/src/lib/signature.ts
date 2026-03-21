import { AppError } from './errors'

export type DecodedSignature = {
  bytes: Uint8Array
  mimeType: string
  extension: 'png' | 'svg'
}

export function decodeSignatureDataUrl(input: string): DecodedSignature {
  const match = input.match(/^data:(image\/(?:png|svg\+xml));base64,(.+)$/)
  if (!match) {
    throw new AppError(
      400,
      'invalid_signature',
      'Signature must be a base64 data URL in PNG or SVG format.',
    )
  }

  const mimeType = match[1]
  const base64 = match[2]
  const extension = mimeType === 'image/png' ? 'png' : 'svg'

  return {
    bytes: Uint8Array.from(Buffer.from(base64, 'base64')),
    mimeType,
    extension,
  }
}
