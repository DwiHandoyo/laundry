import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import * as argon2 from 'argon2'
import { Role, ServiceCategory, ServiceUnit } from '@laundry/shared'
import { AppModule } from '../../src/app.module'
import { PrismaService } from '../../src/prisma/prisma.service'

export interface TestContext {
  app: INestApplication
  prisma: PrismaService
  ownerToken: string
  staffToken: string
  ownerId: string
  staffId: string
}

export async function bootstrapTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
  const app = moduleRef.createNestApplication()
  app.setGlobalPrefix('api/v1')
  await app.init()
  return app
}

export async function seedUsersAndServices(app: INestApplication) {
  const prisma = app.get(PrismaService)
  await prisma.truncateAll()

  const passwordHash = await argon2.hash('rahasia123', { type: argon2.argon2id })
  const [owner, staff] = await Promise.all([
    prisma.user.create({
      data: { name: 'Pemilik', email: 'owner@test.id', passwordHash, role: Role.OWNER },
    }),
    prisma.user.create({
      data: { name: 'Budi Santoso', email: 'staff@test.id', passwordHash, role: Role.STAFF },
    }),
  ])

  const wash = await prisma.service.create({
    data: {
      code: 'SHOE_WASH_REGULAR',
      name: 'Cuci Sepatu Reguler',
      category: ServiceCategory.SHOE_LAUNDRY,
      unit: ServiceUnit.PAIR,
      price: 35_000,
      estimatedDays: 3,
    },
  })
  const glue = await prisma.service.create({
    data: {
      code: 'REGLUE_SOLE',
      name: 'Reglue Sol',
      category: ServiceCategory.REGLUE,
      unit: ServiceUnit.PAIR,
      price: 50_000,
      estimatedDays: 3,
    },
  })
  const retired = await prisma.service.create({
    data: {
      code: 'RETIRED_SERVICE',
      name: 'Layanan Nonaktif',
      category: ServiceCategory.OTHER,
      unit: ServiceUnit.ITEM,
      price: 10_000,
      estimatedDays: 1,
      isActive: false,
    },
  })

  return { prisma, owner, staff, wash, glue, retired }
}

export const API = '/api/v1'
