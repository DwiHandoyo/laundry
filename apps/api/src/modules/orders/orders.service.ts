import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Prisma } from '@prisma/client'
import {
  OrderStatus,
  Role,
  type CreateOrderInput,
  type OrderResponse,
  type OrderSummaryResponse,
  type Paginated,
  type PaymentResponse,
  type QueryOrdersInput,
  type RecordPaymentInput,
  type UpdateOrderStatusInput,
} from '@laundry/shared'
import type { AuthUser } from '../../common/decorators/current-user.decorator'
import { AppException } from '../../common/exceptions/app.exception'
import { zonedDayRange } from '../../common/utils/date'
import { normalizePhone } from '../../common/utils/phone'
import { PrismaService } from '../../prisma/prisma.service'
import { OrderNumberService } from './order-number.service'
import {
  assertAllServicesActive,
  assertAllServicesFound,
  buildOrderItems,
  calculateEstimatedDoneAt,
  calculateOrderTotals,
  derivePaymentStatus,
} from './order-pricing'
import { assertTransitionAllowed, isFinalStatus } from './order-status.rules'
import {
  ORDER_FULL_INCLUDE,
  ORDER_SUMMARY_INCLUDE,
  toOrderResponse,
  toOrderSummaryResponse,
} from './orders.mapper'

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderNumberService: OrderNumberService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Satu-satunya jalur pembuatan pesanan. Seluruhnya dalam satu transaksi,
   * sehingga tidak mungkin ada Order tanpa OrderItem atau tanpa riwayat status.
   */
  async create(dto: CreateOrderInput, currentUser: AuthUser): Promise<OrderResponse> {
    if (dto.items.length === 0) throw new AppException('ORDER_EMPTY_ITEMS')
    if (dto.discount > 0 && currentUser.role !== Role.OWNER) {
      throw new AppException('FORBIDDEN_ROLE', { field: 'discount' })
    }

    const order = await this.prisma.$transaction(async (tx) => {
      const customerId = await this.resolveCustomer(tx, dto)

      // Harga SELALU dari database, tidak pernah dari client.
      const services = await tx.service.findMany({
        where: { id: { in: dto.items.map((i) => i.serviceId) } },
      })
      assertAllServicesFound(services, dto.items)
      assertAllServicesActive(services)

      const items = buildOrderItems(dto.items, services)
      const totals = calculateOrderTotals(items, dto.discount)
      const receivedAt = new Date()
      const estimatedDoneAt = calculateEstimatedDoneAt(services, receivedAt)

      const orderNumber = await this.orderNumberService.next(tx, receivedAt)

      return tx.order.create({
        data: {
          orderNumber,
          customerId,
          createdById: currentUser.id,
          status: OrderStatus.RECEIVED,
          subtotal: totals.subtotal,
          discount: totals.discount,
          total: totals.total,
          notes: dto.notes ?? null,
          receivedAt,
          estimatedDoneAt,
          items: { create: items },
          statusHistory: {
            create: {
              fromStatus: null,
              toStatus: OrderStatus.RECEIVED,
              changedById: currentUser.id,
            },
          },
        },
        include: ORDER_FULL_INCLUDE,
      })
    })

    return toOrderResponse(order, currentUser.role)
  }

  async findAll(query: QueryOrdersInput): Promise<Paginated<OrderSummaryResponse>> {
    const timeZone = this.config.getOrThrow<string>('APP_TIMEZONE')
    const where: Prisma.OrderWhereInput = {}

    if (query.status) {
      const statuses = query.status
        .split(',')
        .map((s) => s.trim())
        .filter((s): s is OrderStatus => s in OrderStatus)
      if (statuses.length > 0) where.status = { in: statuses }
    }

    if (query.customerId) where.customerId = query.customerId

    if (query.from || query.to) {
      const receivedAt: Prisma.DateTimeFilter = {}
      if (query.from) receivedAt.gte = zonedDayRange(query.from, timeZone).start
      if (query.to) receivedAt.lt = zonedDayRange(query.to, timeZone).end
      where.receivedAt = receivedAt
    }

    if (query.search) {
      where.OR = [
        { orderNumber: { contains: query.search, mode: 'insensitive' } },
        { customer: { name: { contains: query.search, mode: 'insensitive' } } },
        { customer: { phone: { contains: query.search.replace(/\D/g, '') } } },
      ]
    }

    const [field, direction] = query.sort.split(':') as [
      'receivedAt' | 'estimatedDoneAt',
      'asc' | 'desc',
    ]

    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { [field]: direction },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: ORDER_SUMMARY_INCLUDE,
      }),
      this.prisma.order.count({ where }),
    ])

    return {
      data: rows.map(toOrderSummaryResponse),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    }
  }

  async findOne(id: string, currentUser: AuthUser): Promise<OrderResponse> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: ORDER_FULL_INCLUDE,
    })
    if (!order) throw new AppException('RESOURCE_NOT_FOUND')
    return toOrderResponse(order, currentUser.role)
  }

  /** Ubah Order dan tulis OrderStatusHistory tidak boleh terpisah. */
  async updateStatus(
    id: string,
    dto: UpdateOrderStatusInput,
    currentUser: AuthUser,
  ): Promise<OrderResponse> {
    const order = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.order.findUnique({ where: { id } })
      if (!existing) throw new AppException('RESOURCE_NOT_FOUND')

      const target = dto.status as OrderStatus
      assertTransitionAllowed(existing, target, currentUser.role)

      if (target === OrderStatus.CANCELLED && !dto.note) {
        throw new AppException('VALIDATION_FAILED', {
          fields: { note: 'Alasan pembatalan wajib diisi' },
        })
      }

      const now = new Date()
      return tx.order.update({
        where: { id },
        data: {
          status: target,
          ...(target === OrderStatus.COMPLETED ? { completedAt: now } : {}),
          ...(target === OrderStatus.CANCELLED
            ? { cancelledAt: now, cancelReason: dto.note ?? null }
            : {}),
          statusHistory: {
            create: {
              fromStatus: existing.status,
              toStatus: target,
              changedById: currentUser.id,
              note: dto.note ?? null,
            },
          },
        },
        include: ORDER_FULL_INCLUDE,
      })
    })

    return toOrderResponse(order, currentUser.role)
  }

  /**
   * `amount` adalah jumlah yang dibayarkan SEKARANG, bukan total kumulatif.
   * paymentStatus diturunkan, tidak pernah diset langsung oleh client.
   */
  async recordPayment(
    id: string,
    dto: RecordPaymentInput,
    _currentUser: AuthUser,
  ): Promise<PaymentResponse> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.order.findUnique({ where: { id } })
      if (!existing) throw new AppException('RESOURCE_NOT_FOUND')

      if (existing.status === OrderStatus.CANCELLED) {
        throw new AppException('ORDER_ALREADY_FINAL', { currentStatus: existing.status })
      }

      const paidAmount = existing.paidAmount + dto.amount
      if (paidAmount > existing.total) {
        throw new AppException('PAYMENT_EXCEEDS_TOTAL', {
          total: existing.total,
          paidAmount: existing.paidAmount,
          remainingAmount: existing.total - existing.paidAmount,
        })
      }

      const updated = await tx.order.update({
        where: { id },
        data: {
          paidAmount,
          paymentStatus: derivePaymentStatus(paidAmount, existing.total),
          paymentMethod: dto.method,
        },
      })

      return {
        id: updated.id,
        total: updated.total,
        paidAmount: updated.paidAmount,
        paymentStatus: updated.paymentStatus,
        paymentMethod: updated.paymentMethod,
      }
    })
  }

  /**
   * Pakai pelanggan yang sudah ada, atau buat baru dari data inline.
   * Kalau nomor HP inline ternyata sudah terdaftar, pakai yang ada dan jangan error —
   * ini alur yang paling sering terjadi di meja outlet.
   */
  private async resolveCustomer(
    tx: Prisma.TransactionClient,
    dto: CreateOrderInput,
  ): Promise<string> {
    if (dto.customerId) {
      const customer = await tx.customer.findUnique({ where: { id: dto.customerId } })
      if (!customer) throw new AppException('RESOURCE_NOT_FOUND', { customerId: dto.customerId })
      return customer.id
    }

    const inline = dto.customer!
    const phone = normalizePhone(inline.phone)
    const existing = await tx.customer.findUnique({ where: { phone } })
    if (existing) return existing.id

    const created = await tx.customer.create({
      data: { name: inline.name, phone, notes: inline.notes ?? null },
    })
    return created.id
  }
}

export { isFinalStatus }
