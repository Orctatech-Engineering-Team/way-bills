import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { assertStorageConfig, config } from '../config'
import { AppError } from './errors'

const r2Client = new S3Client({
  region: config.r2Region,
  endpoint: config.r2Endpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId: config.r2AccessKeyId,
    secretAccessKey: config.r2SecretAccessKey,
  },
})

async function uploadStorageFile(options: {
  bytes: Uint8Array
  mimeType: string
  bucket: string
  path: string
  publicBaseUrl: string
}) {
  assertStorageConfig()

  try {
    await r2Client.send(
      new PutObjectCommand({
        Bucket: options.bucket,
        Key: options.path,
        Body: Buffer.from(options.bytes),
        ContentType: options.mimeType,
      }),
    )
  } catch (error) {
    throw new AppError(
      502,
      'storage_upload_failed',
      'Unable to upload the storage file.',
      error instanceof Error ? error.message : error,
    )
  }

  return `${options.publicBaseUrl.replace(/\/$/, '')}/${options.path}`
}

export async function uploadSignatureFile(options: {
  bytes: Uint8Array
  mimeType: string
  path: string
}) {
  return uploadStorageFile({
    ...options,
    bucket: config.r2StorageBucket,
    publicBaseUrl: config.r2StoragePublicBaseUrl,
  })
}

export async function uploadDocumentFile(options: {
  bytes: Uint8Array
  path: string
}) {
  return uploadStorageFile({
    ...options,
    bucket: config.r2DocumentBucket,
    mimeType: 'application/pdf',
    publicBaseUrl: config.r2DocumentPublicBaseUrl,
  })
}

export async function uploadProfileImageFile(options: {
  bytes: Uint8Array
  mimeType: string
  path: string
}) {
  return uploadStorageFile({
    ...options,
    bucket: config.r2StorageBucket,
    publicBaseUrl: config.r2StoragePublicBaseUrl,
  })
}

export async function uploadWaybillReceiptFile(options: {
  bytes: Uint8Array
  mimeType: string
  path: string
}) {
  return uploadStorageFile({
    ...options,
    bucket: config.r2StorageBucket,
    publicBaseUrl: config.r2StoragePublicBaseUrl,
  })
}
