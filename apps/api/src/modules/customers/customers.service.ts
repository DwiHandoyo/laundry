import { Injectable } from '@nestjs/common'
import { Prisma, type Customer } from '@prisma/client'
import type {
  CreateCustomerInput,
  CustomerResponse,
  Paginated,
  QueryCustomersInput,
  UpdateCustomerInput,
} from '@laundry/shared'
import { AppException } from '../../common/exceptions/app.exception'
import { normalizePhone } from '../../common/utils/phone'
import { PrismaService } from '../../prisma/prisma.service'

export function toCustomerResponse(c: Customer): CustomerResponse {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    notes: c.notes,
    createdAt: c.createdAt.toISOString(),
  }
}

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryCustomersInput): Promise<Paginated<CustomerResponse>> {
    const where: Prisma.CustomerWhereInput = query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { phone: { contains: normalizePhone(query.search).replace(/^\+62/, '') } },
          ],
        }
      : {}

    const [rows, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          _count: { select: { orders: true } },
          orders: { select: { receivedAt: true }, orderBy: { receivedAt: 'desc' }, take: 1 },
        },
      }),
      this.prisma.customer.count({ where }),
    ])

    return {
      data: rows.map((c) => ({
        ...toCustomerResponse(c),
        orderCount: c._count.orders,
        lastOrderAt: c.orders[0]?.receivedAt.toISOString() ?? null,
      })),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    }
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        _count: { select: { orders: true } },
        orders: {
          orderBy: { receivedAt: 'desc' },
          take: 5,
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentStatus: true,
            total: true,
            receivedAt: true,
            estimatedDoneAt: true,
          },
        },
      },
    })
    if (!customer) throw new AppException('RESOURCE_NOT_FOUND')

    return {
      ...toCustomerResponse(customer),
      orderCount: customer._count.orders,
      lastOrderAt: customer.orders[0]?.receivedAt.toISOString() ?? null,
      recentOrders: customer.orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        paymentStatus: o.paymentStatus,
        total: o.total,
        receivedAt: o.receivedAt.toISOString(),
        estimatedDoneAt: o.estimatedDoneAt.toISOString(),
      })),
    }
  }

  async create(input: CreateCustomerInput): Promise<CustomerResponse> {
    const phone = normalizePhone(input.phone)
    const existing = await this.prisma.customer.findUnique({ where: { phone } })
    if (existing) {
      // details.customerId membuat client bisa langsung menawarkan "pakai pelanggan ini"
      throw new AppException('CUSTOMER_PHONE_TAKEN', { customerId: existing.id, phone })
    }

    const customer = await this.prisma.customer.create({
      data: { name: input.name, phone, notes: input.notes ?? null },
    })
    return toCustomerResponse(customer)
  }

  async update(id: string, input: UpdateCustomerInput): Promise<CustomerResponse> {
    const existing = await this.prisma.customer.findUnique({ where: { id } })
    if (!existing) throw new AppException('RESOURCE_NOT_FOUND')

    let phone: string | undefined
    if (input.phone !== undefined) {
      phone = normalizePhone(input.phone)
      const clash = await this.prisma.customer.findUnique({ where: { phone } })
      if (clash && clash.id !== id) {
        throw new AppException('CUSTOMER_PHONE_TAKEN', { customerId: clash.id, phone })
      }
    }

    const customer = await this.prisma.customer.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
      },
    })
    return toCustomerResponse(customer)
  }
}
