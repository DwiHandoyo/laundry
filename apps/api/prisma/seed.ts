import { PrismaClient, ServiceCategory, ServiceUnit, Role } from '@prisma/client'
import * as argon2 from 'argon2'

const prisma = new PrismaClient()

const SERVICES = [
  {
    code: 'SHOE_WASH_REGULAR',
    name: 'Cuci Sepatu Reguler',
    category: ServiceCategory.SHOE_LAUNDRY,
    unit: ServiceUnit.PAIR,
    price: 35_000,
    estimatedDays: 3,
    description: 'Cuci menyeluruh bagian luar dan sol',
  },
  {
    code: 'SHOE_WASH_EXPRESS',
    name: 'Cuci Sepatu Express',
    category: ServiceCategory.SHOE_LAUNDRY,
    unit: ServiceUnit.PAIR,
    price: 60_000,
    estimatedDays: 1,
    description: 'Selesai dalam satu hari',
  },
  {
    code: 'SHOE_WASH_DEEP',
    name: 'Deep Clean',
    category: ServiceCategory.SHOE_LAUNDRY,
    unit: ServiceUnit.PAIR,
    price: 75_000,
    estimatedDays: 4,
    description: 'Pembersihan menyeluruh termasuk bagian dalam',
  },
  {
    code: 'REPAINT_FULL',
    name: 'Repaint Full',
    category: ServiceCategory.REPAINT,
    unit: ServiceUnit.PAIR,
    price: 150_000,
    estimatedDays: 7,
    description: 'Pengecatan ulang seluruh permukaan',
  },
  {
    code: 'REPAINT_PARTIAL',
    name: 'Repaint Sebagian',
    category: ServiceCategory.REPAINT,
    unit: ServiceUnit.PAIR,
    price: 90_000,
    estimatedDays: 5,
    description: 'Pengecatan ulang pada bagian tertentu',
  },
  {
    code: 'REGLUE_SOLE',
    name: 'Reglue Sol',
    category: ServiceCategory.REGLUE,
    unit: ServiceUnit.PAIR,
    price: 50_000,
    estimatedDays: 3,
    description: 'Perekatan ulang sol yang lepas',
  },
]

async function main(): Promise<void> {
  for (const service of SERVICES) {
    await prisma.service.upsert({
      where: { code: service.code },
      update: {},
      create: service,
    })
  }
  console.log(`Layanan: ${SERVICES.length} baris siap.`)

  // Kredensial owner berasal dari environment variable, tidak ditulis di dalam kode.
  const email = process.env.SEED_OWNER_EMAIL
  const password = process.env.SEED_OWNER_PASSWORD

  if (!email || !password) {
    console.log('SEED_OWNER_EMAIL / SEED_OWNER_PASSWORD tidak diisi — akun owner dilewati.')
    return
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log(`Akun owner ${email} sudah ada.`)
    return
  }

  await prisma.user.create({
    data: {
      name: 'Pemilik',
      email,
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      role: Role.OWNER,
    },
  })
  console.log(`Akun owner dibuat: ${email}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
