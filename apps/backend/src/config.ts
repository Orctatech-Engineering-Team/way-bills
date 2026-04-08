const DEFAULTS = {
  appEnv: 'development',
  appOrigin: 'http://localhost:3000',
  apiPort: 3001,
  databaseUrl: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  jwtSecret: 'change-me-in-production',
  mailEnabled: 'false',
  smtpHost: '',
  smtpPort: 587,
  smtpSecure: 'false',
  smtpUser: '',
  smtpPassword: '',
  mailFrom: '',
  mailReplyTo: '',
  r2Endpoint: '',
  r2Region: 'auto',
  r2AccessKeyId: '',
  r2SecretAccessKey: '',
  r2StoragePublicBaseUrl: '',
  r2StorageBucket: 'waybill-signatures',
  r2DocumentPublicBaseUrl: '',
  r2DocumentBucket: 'waybill-documents',
  invoiceAutomationEnabled: 'false',
  invoiceAutomationIntervalMinutes: 15,
  invoiceAutomationLookbackWeeks: 8,
  automationActorPhone: '',
  seedDefaultPassword: 'ChangeMe123!',
} as const

export type AppConfig = {
  appEnv: string
  appOrigin: string
  allowedAppOrigins: string[]
  apiPort: number
  databaseUrl: string
  jwtSecret: string
  mailEnabled: boolean
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  smtpUser: string
  smtpPassword: string
  mailFrom: string
  mailReplyTo: string
  r2Endpoint: string
  r2Region: string
  r2AccessKeyId: string
  r2SecretAccessKey: string
  r2StoragePublicBaseUrl: string
  r2StorageBucket: string
  r2DocumentPublicBaseUrl: string
  r2DocumentBucket: string
  invoiceAutomationEnabled: boolean
  invoiceAutomationIntervalMinutes: number
  invoiceAutomationLookbackWeeks: number
  automationActorPhone: string
  seedDefaultPassword: string
}

function booleanEnv(value: string | undefined, fallback: string) {
  const resolved = (value ?? fallback).trim().toLowerCase()
  return resolved === 'true' || resolved === '1' || resolved === 'yes' || resolved === 'on'
}

function expandLoopbackOrigin(origin: string) {
  try {
    const url = new URL(origin)
    if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      return [origin]
    }

    const hosts = ['localhost', '127.0.0.1']
    return hosts.map(
      (host) => `${url.protocol}//${host}${url.port ? `:${url.port}` : ''}`,
    )
  } catch {
    return [origin]
  }
}

function resolveAllowedAppOrigins() {
  const configuredOrigins = (Bun.env.APP_ORIGIN ?? DEFAULTS.appOrigin)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  const expandedOrigins =
    (Bun.env.APP_ENV ?? DEFAULTS.appEnv) === 'production'
      ? configuredOrigins
      : configuredOrigins.flatMap(expandLoopbackOrigin)

  return [...new Set(expandedOrigins)]
}

export const config: AppConfig = {
  appEnv: Bun.env.APP_ENV ?? DEFAULTS.appEnv,
  appOrigin: Bun.env.APP_ORIGIN ?? DEFAULTS.appOrigin,
  allowedAppOrigins: resolveAllowedAppOrigins(),
  apiPort: Number(Bun.env.API_PORT ?? DEFAULTS.apiPort),
  databaseUrl: Bun.env.DATABASE_URL ?? DEFAULTS.databaseUrl,
  jwtSecret: Bun.env.JWT_SECRET ?? DEFAULTS.jwtSecret,
  mailEnabled: booleanEnv(Bun.env.MAIL_ENABLED, DEFAULTS.mailEnabled),
  smtpHost: Bun.env.SMTP_HOST ?? DEFAULTS.smtpHost,
  smtpPort: Number(Bun.env.SMTP_PORT ?? DEFAULTS.smtpPort),
  smtpSecure: booleanEnv(Bun.env.SMTP_SECURE, DEFAULTS.smtpSecure),
  smtpUser: Bun.env.SMTP_USER ?? DEFAULTS.smtpUser,
  smtpPassword: Bun.env.SMTP_PASSWORD ?? DEFAULTS.smtpPassword,
  mailFrom: Bun.env.MAIL_FROM ?? DEFAULTS.mailFrom,
  mailReplyTo: Bun.env.MAIL_REPLY_TO ?? DEFAULTS.mailReplyTo,
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
  invoiceAutomationEnabled: booleanEnv(
    Bun.env.INVOICE_AUTOMATION_ENABLED,
    DEFAULTS.invoiceAutomationEnabled,
  ),
  invoiceAutomationIntervalMinutes: Number(
    Bun.env.INVOICE_AUTOMATION_INTERVAL_MINUTES ??
      DEFAULTS.invoiceAutomationIntervalMinutes,
  ),
  invoiceAutomationLookbackWeeks: Number(
    Bun.env.INVOICE_AUTOMATION_LOOKBACK_WEEKS ??
      DEFAULTS.invoiceAutomationLookbackWeeks,
  ),
  automationActorPhone:
    Bun.env.AUTOMATION_ACTOR_PHONE ?? DEFAULTS.automationActorPhone,
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

export function assertMailConfig() {
  if (
    !config.mailEnabled ||
    !config.smtpHost ||
    !config.smtpPort ||
    !config.smtpUser ||
    !config.smtpPassword ||
    !config.mailFrom
  ) {
    throw new Error(
      'MAIL_ENABLED, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, and MAIL_FROM must be configured for email delivery.',
    )
  }
}
