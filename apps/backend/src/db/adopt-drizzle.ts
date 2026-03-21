import postgres from 'postgres'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import { config } from '../config'

const migrationsFolder = new URL('../../drizzle', import.meta.url).pathname

async function run() {
  const sql = postgres(config.databaseUrl, { prepare: false })
  const migrations = readMigrationFiles({ migrationsFolder })
  const baseline = migrations[0]

  if (!baseline) {
    throw new Error('No drizzle baseline migration was found to adopt.')
  }

  await sql`
    CREATE SCHEMA IF NOT EXISTS drizzle
  `

  await sql`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `

  const existing = await sql<{ id: number }[]>`
    SELECT id
    FROM drizzle.__drizzle_migrations
    WHERE hash = ${baseline.hash}
    LIMIT 1
  `

  if (existing.length === 0) {
    await sql`
      INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
      VALUES (${baseline.hash}, ${baseline.folderMillis})
    `
  }

  await sql.end()
  console.log('Adopted drizzle baseline migration.')
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
