import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Prisma } from '@prisma/client'
import { zonedDateKey } from '../../common/utils/date'

@Injectable()
export class OrderNumberService {
  constructor(private readonly config: ConfigService) {}

  /**
   * Menerbitkan nomor pesanan berurutan per hari: LDY-YYYYMMDD-NNN.
   *
   * COUNT(*) + 1 TIDAK dipakai — dua request bersamaan akan membaca hitungan
   * yang sama dan menghasilkan nomor kembar. INSERT ... ON CONFLICT DO UPDATE
   * mengunci baris tanggal dan menyerialkan keduanya.
   *
   * Harus dipanggil di dalam transaksi yang sama dengan pembuatan Order,
   * supaya nomor tidak terbuang kalau langkah berikutnya gagal.
   */
  async next(tx: Prisma.TransactionClient, now: Date = new Date()): Promise<string> {
    const timeZone = this.config.getOrThrow<string>('APP_TIMEZONE')
    const dateKey = zonedDateKey(now, timeZone)

    const rows = await tx.$queryRaw<Array<{ lastNumber: number }>>`
      INSERT INTO "order_sequences" ("date", "lastNumber")
      VALUES (${dateKey}, 1)
      ON CONFLICT ("date")
      DO UPDATE SET "lastNumber" = "order_sequences"."lastNumber" + 1
      RETURNING "lastNumber"
    `

    const sequence = rows[0].lastNumber
    return `LDY-${dateKey}-${String(sequence).padStart(3, '0')}`
  }
}
