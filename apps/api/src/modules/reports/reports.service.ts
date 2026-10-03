import { Injectable } from '@nestjs/common'
import { OrderStatus, PaymentStatus, type DailySummaryResponse } from '@laundry/shared'
import { ConfigService } from '@nestjs/config'
import { zonedDateString, zonedDayRange } from '../../common/utils/date'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async dailySummary(date?: string): Promise<DailySummaryResponse> {
    const timeZone = this.config.getOrThrow<string>('APP_TIMEZONE')
    const targetDate = date ?? zonedDateString(new Date(), timeZone)
    const { start, end } = zonedDayRange(targetDate, timeZone)

    const [statusGroups, newOrders, completedOrders, billed, collected, outstanding, topServices] =
      await Promise.all([
        // Foto kondisi SAAT INI — berapa yang menumpuk di rak, tanpa memandang tanggal masuk.
        this.prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),

        this.prisma.order.count({ where: { receivedAt: { gte: start, lt: end } } }),

        this.prisma.order.count({ where: { completedAt: { gte: start, lt: end } } }),

        // SUM di-cast ke BIGINT supaya total tidak meluap batas Int PostgreSQL.
        this.prisma.$queryRaw<Array<{ sum: bigint | null }>>`
          SELECT COALESCE(SUM("total"), 0)::BIGINT AS sum
          FROM "orders"
          WHERE "receivedAt" >= ${start} AND "receivedAt" < ${end}
            AND "status" <> 'CANCELLED'
        `,

        // Pendekatan: pesanan yang tersentuh hari itu dan sudah ada pembayarannya.
        // Angka yang benar-benar tepat butuh tabel Payment (lihat docs/07-roadmap.md).
        this.prisma.$queryRaw<Array<{ sum: bigint | null }>>`
          SELECT COALESCE(SUM("paidAmount"), 0)::BIGINT AS sum
          FROM "orders"
          WHERE "updatedAt" >= ${start} AND "updatedAt" < ${end}
            AND "paidAmount" > 0
            AND "status" <> 'CANCELLED'
        `,

        // Lintas tanggal: semua pesanan aktif yang belum lunas.
        this.prisma.$queryRaw<Array<{ sum: bigint | null }>>`
          SELECT COALESCE(SUM("total" - "paidAmount"), 0)::BIGINT AS sum
          FROM "orders"
          WHERE "status" <> 'CANCELLED' AND "paymentStatus" <> 'PAID'
        `,

        this.prisma.$queryRaw<
          Array<{ serviceId: string; serviceName: string; quantity: bigint; revenue: bigint }>
        >`
          SELECT oi."serviceId"       AS "serviceId",
                 oi."serviceName"     AS "serviceName",
                 SUM(oi."quantity")::BIGINT AS quantity,
                 SUM(oi."subtotal")::BIGINT AS revenue
          FROM "order_items" oi
          JOIN "orders" o ON o."id" = oi."orderId"
          WHERE o."receivedAt" >= ${start} AND o."receivedAt" < ${end}
            AND o."status" <> 'CANCELLED'
          GROUP BY oi."serviceId", oi."serviceName"
          ORDER BY quantity DESC
          LIMIT 5
        `,
      ])

    const ordersByStatus = Object.fromEntries(
      Object.values(OrderStatus).map((s) => [s, 0]),
    ) as Record<OrderStatus, number>
    for (const group of statusGroups) {
      ordersByStatus[group.status] = group._count._all
    }

    void PaymentStatus

    return {
      date: targetDate,
      ordersByStatus,
      newOrders,
      completedOrders,
      revenue: {
        billed: Number(billed[0]?.sum ?? 0),
        collected: Number(collected[0]?.sum ?? 0),
        outstanding: Number(outstanding[0]?.sum ?? 0),
      },
      topServices: topServices.map((t) => ({
        serviceId: t.serviceId,
        serviceName: t.serviceName,
        quantity: Number(t.quantity),
        revenue: Number(t.revenue),
      })),
    }
  }
}
