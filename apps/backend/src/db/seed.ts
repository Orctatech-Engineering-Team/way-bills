import { eq } from 'drizzle-orm'
import { db, closeDatabase } from './client'
import { clients, statusLogs, users, waybills } from './schema'
import { config } from '../config'
import { generateWaybillNumber } from '../lib/waybills'

type SeedUser = {
  id: string
  name: string
  phone: string
  role: 'admin' | 'ops' | 'rider'
  vehicleType?: string
  vehiclePlateNumber?: string
  licenseNumber?: string
  address?: string
  notes?: string
}

const seedUsers: SeedUser[] = [
  { id: 'user-admin-001', name: 'Admin User', phone: '+233200000001', role: 'admin' },
  { id: 'user-ops-001', name: 'Ops User', phone: '+233200000002', role: 'ops' },
  {
    id: 'user-rider-001',
    name: 'Rider One',
    phone: '+233200000003',
    role: 'rider',
    vehicleType: 'Motorbike',
    vehiclePlateNumber: 'GT-4821-24',
    licenseNumber: 'RID-0001',
    address: 'Spintex Road, Accra',
    notes: 'Primary seeded rider for local verification',
  },
]

const seedClient = {
  id: 'client-seed-001',
  name: 'Acme Retail',
  contactName: 'Operations Desk',
  contactPhone: '+233300000111',
  contactEmail: 'ops@acmeretail.test',
  billingAddress: 'Ring Road Central, Accra',
  currency: 'GHS',
  paymentTermsDays: 7,
  standardDeliveryRateCents: 3000,
  weeklyBandLimit: 20,
  overflowDeliveryRateCents: 2500,
  active: true,
}

async function upsertUser(user: SeedUser, passwordHash: string) {
  const existing = await db.query.users.findFirst({
    where: eq(users.phone, user.phone),
  })

  if (existing) {
    await db
      .update(users)
      .set({
        name: user.name,
        role: user.role,
        active: true,
        passwordHash,
        vehicleType: user.vehicleType ?? null,
        vehiclePlateNumber: user.vehiclePlateNumber ?? null,
        licenseNumber: user.licenseNumber ?? null,
        address: user.address ?? null,
        notes: user.notes ?? null,
      })
      .where(eq(users.id, existing.id))

    return existing.id
  }

  await db.insert(users).values({
    ...user,
    passwordHash,
    active: true,
  })

  return user.id
}

async function upsertClient() {
  const existing = await db.query.clients.findFirst({
    where: eq(clients.name, seedClient.name),
  })

  if (existing) {
    await db
      .update(clients)
      .set({
        contactName: seedClient.contactName,
        contactPhone: seedClient.contactPhone,
        contactEmail: seedClient.contactEmail,
        billingAddress: seedClient.billingAddress,
        currency: seedClient.currency,
        paymentTermsDays: seedClient.paymentTermsDays,
        standardDeliveryRateCents: seedClient.standardDeliveryRateCents,
        weeklyBandLimit: seedClient.weeklyBandLimit,
        overflowDeliveryRateCents: seedClient.overflowDeliveryRateCents,
        active: seedClient.active,
      })
      .where(eq(clients.id, existing.id))

    return existing.id
  }

  await db.insert(clients).values(seedClient)
  return seedClient.id
}

async function run() {
  const passwordHash = await Bun.password.hash(config.seedDefaultPassword)
  const ids = new Map<string, string>()

  for (const user of seedUsers) {
    ids.set(user.role, await upsertUser(user, passwordHash))
  }

  const clientId = await upsertClient()

  const existingWaybill = await db.query.waybills.findFirst()
  if (!existingWaybill) {
    const waybillId = 'waybill-seed-001'
    await db.insert(waybills).values({
      id: waybillId,
      waybillNumber: generateWaybillNumber(new Date(), 1),
      orderReference: 'ORDER-SEED-001',
      clientId,
      customerName: 'Seed Customer',
      customerPhone: '+233244444444',
      deliveryAddress: 'Airport Residential, Accra',
      itemValueCents: 120000,
      notes: 'Seeded waybill for local verification',
      assignedRiderId: ids.get('rider') ?? null,
      status: 'assigned',
      createdBy: ids.get('ops') ?? ids.get('admin')!,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    await db.insert(statusLogs).values({
      id: 'status-log-seed-001',
      waybillId,
      fromStatus: 'created',
      toStatus: 'assigned',
      changedBy: ids.get('ops') ?? ids.get('admin')!,
      changedAt: new Date(),
      note: 'Seeded assignment',
    })
  }

  console.log('Seed complete.')
  console.log(`Default password: ${config.seedDefaultPassword}`)
}

run()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await closeDatabase()
  })
