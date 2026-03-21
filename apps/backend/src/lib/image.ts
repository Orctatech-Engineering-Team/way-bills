import { AppError } from './errors'

const IMAGE_DATA_URL =
  /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/

export function decodeImageDataUrl(input: string) {
  const match = input.match(IMAGE_DATA_URL)

  if (!match) {
    throw new AppError(
      400,
      'invalid_image',
      'Image must be a base64 data URL in PNG, JPEG, or WEBP format.',
    )
  }

  const mimeType = match[1]
  const base64 = match[2]
  const extension =
    mimeType === 'image/png'
      ? 'png'
      : mimeType === 'image/jpeg'
        ? 'jpg'
        : 'webp'

  return {
    mimeType,
    extension,
    bytes: Uint8Array.from(Buffer.from(base64, 'base64')),
  }
}
