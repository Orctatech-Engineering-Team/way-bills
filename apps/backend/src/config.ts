const DEFAULTS = {
  appEnv: 'development',
  appOrigin: 'http://localhost:3000',
  apiPort: 3001,
  databaseUrl: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  jwtSecret: 'change-me-in-production',
  r2Endpoint: '',
  r2Region: 'auto',
  r2AccessKeyId: '',
  r2SecretAccessKey: '',
  r2StoragePublicBaseUrl: '',
  r2StorageBucket: 'waybill-signatures',
  r2DocumentPublicBaseUrl: '',
  r2DocumentBucket: 'waybill-documents',
  seedDefaultPassword: 'ChangeMe123!',
} as const

export type AppConfig = {
  appEnv: string
  appOrigin: string
  apiPort: number
  databaseUrl: string
  jwtSecret: string
  r2Endpoint: string
  r2Region: string
  r2AccessKeyId: string
  r2SecretAccessKey: string
  r2StoragePublicBaseUrl: string
  r2StorageBucket: string
  r2DocumentPublicBaseUrl: string
  r2DocumentBucket: string
  seedDefaultPassword: string
}

export const config: AppConfig = {
  appEnv: Bun.env.APP_ENV ?? DEFAULTS.appEnv,
  appOrigin: Bun.env.APP_ORIGIN ?? DEFAULTS.appOrigin,
  apiPort: Number(Bun.env.API_PORT ?? DEFAULTS.apiPort),
  databaseUrl: Bun.env.DATABASE_URL ?? DEFAULTS.databaseUrl,
  jwtSecret: Bun.env.JWT_SECRET ?? DEFAULTS.jwtSecret,
  r2Endpoint: Bun.env.R2_ENDPOINT ?? DEFAULTS.r2Endpoint,
  r2Region: Bun.env.R2_REGION ?? DEFAULTS.r2Region,
  r2AccessKeyId: Bun.env.R2_ACCESS_KEY_ID ?? DEFAULTS.r2AccessKeyId,
  r2SecretAccessKey:
    Bun.env.R2_SECRET_ACCESS_KEY ?? DEFAULTS.r2SecretAccessKey,
  r2StoragePublicBaseUrl:
    Bun.env.R2_STORAGE_PUBLIC_BASE_URL ??
    DEFAULTS.r2StoragePublicBaseUrl,
  r2StorageBucket: Bun.env.R2_STORAGE_BUCKET ?? DEFAULTS.r2StorageBucket,
  r2DocumentPublicBaseUrl:
    Bun.env.R2_DOCUMENT_PUBLIC_BASE_URL ??
    Bun.env.R2_STORAGE_PUBLIC_BASE_URL ??
    DEFAULTS.r2DocumentPublicBaseUrl,
  r2DocumentBucket:
    Bun.env.R2_DOCUMENT_BUCKET ??
    Bun.env.R2_STORAGE_BUCKET ??
    DEFAULTS.r2DocumentBucket,
  seedDefaultPassword:
    Bun.env.SEED_DEFAULT_PASSWORD ?? DEFAULTS.seedDefaultPassword,
}

export function assertStorageConfig() {
  if (
    !config.r2Endpoint ||
    !config.r2AccessKeyId ||
    !config.r2SecretAccessKey ||
    !config.r2StoragePublicBaseUrl ||
    !config.r2DocumentPublicBaseUrl
  ) {
    throw new Error(
      'R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_STORAGE_PUBLIC_BASE_URL, and R2_DOCUMENT_PUBLIC_BASE_URL must be configured for storage uploads.',
    )
  }
}
