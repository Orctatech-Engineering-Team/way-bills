import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schema'
import { config } from '../config'

const sql = postgres(config.databaseUrl, {
  max: 10,
  idle_timeout: 20,
  prepare: false,
})

export const db = drizzle(sql, { schema })

export async function closeDatabase() {
  await sql.end()
}
