import { eq } from 'drizzle-orm'
import { db, closeDatabase } from './client'
import { users } from './schema'

function readRequiredEnv(name: string) {
  const value = Bun.env[name]?.trim()
  if (!value) {
    throw new Error(`${name} must be set.`)
  }

  return value
}

async function run() {
  const name = readRequiredEnv('BOOTSTRAP_ADMIN_NAME')
  const phone = readRequiredEnv('BOOTSTRAP_ADMIN_PHONE')
  const password = readRequiredEnv('BOOTSTRAP_ADMIN_PASSWORD')

  const passwordHash = await Bun.password.hash(password)
  const existing = await db.query.users.findFirst({
    where: eq(users.phone, phone),
  })

  if (existing) {
    if (existing.role !== 'admin') {
      throw new Error(
        `A non-admin account already exists for ${phone}. Update it manually before bootstrapping an admin with this phone.`,
      )
    }

    await db
      .update(users)
      .set({
        name,
        passwordHash,
        active: true,
      })
      .where(eq(users.id, existing.id))

    console.log(`Updated existing admin account for ${phone}.`)
    return
  }

  await db.insert(users).values({
    id: crypto.randomUUID(),
    name,
    phone,
    role: 'admin',
    passwordHash,
    active: true,
  })

  console.log(`Created initial admin account for ${phone}.`)
}

run()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await closeDatabase()
  })
