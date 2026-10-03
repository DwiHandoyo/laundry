import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect()
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect()
  }

  /** Hanya untuk test — mengosongkan seluruh tabel transaksional. */
  async truncateAll(): Promise<void> {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('truncateAll() hanya boleh dipanggil di lingkungan test')
    }
    await this.$executeRawUnsafe(`
      TRUNCATE TABLE "order_status_history", "order_items", "orders",
                     "order_sequences", "customers", "services", "users"
      RESTART IDENTITY CASCADE
    `)
  }
}
