import { Injectable } from '@nestjs/common'
import { Prisma, type Service } from '@prisma/client'
import type {
  CreateServiceInput,
  QueryServicesInput,
  ServiceResponse,
  UpdateServiceInput,
} from '@laundry/shared'
import { AppException } from '../../common/exceptions/app.exception'
import { PrismaService } from '../../prisma/prisma.service'

export function toServiceResponse(s: Service): ServiceResponse {
  return {
    id: s.id,
    code: s.code,
    name: s.name,
    category: s.category,
    unit: s.unit,
    price: s.price,
    estimatedDays: s.estimatedDays,
    description: s.description,
    isActive: s.isActive,
  }
}

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryServicesInput): Promise<{ data: ServiceResponse[] }> {
    const where: Prisma.ServiceWhereInput = {
      isActive: query.isActive,
      ...(query.category ? { category: query.category } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search.toUpperCase() } },
            ],
          }
        : {}),
    }

    const services = await this.prisma.service.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    })
    return { data: services.map(toServiceResponse) }
  }

  async findOne(id: string): Promise<ServiceResponse> {
    const service = await this.prisma.service.findUnique({ where: { id } })
    if (!service) throw new AppException('RESOURCE_NOT_FOUND')
    return toServiceResponse(service)
  }

  async create(input: CreateServiceInput): Promise<ServiceResponse> {
    const existing = await this.prisma.service.findUnique({ where: { code: input.code } })
    if (existing) throw new AppException('SERVICE_CODE_TAKEN', { code: input.code })

    const service = await this.prisma.service.create({
      data: {
        code: input.code,
        name: input.name,
        category: input.category,
        unit: input.unit,
        price: input.price,
        estimatedDays: input.estimatedDays,
        description: input.description ?? null,
      },
    })
    return toServiceResponse(service)
  }

  /**
   * `code` sengaja tidak bisa diubah — dipakai sebagai referensi stabil untuk seed.
   * Mengubah `price` TIDAK memengaruhi pesanan yang sudah ada, karena OrderItem
   * menyimpan snapshot harga saat pesanan dibuat.
   */
  async update(id: string, input: UpdateServiceInput): Promise<ServiceResponse> {
    const existing = await this.prisma.service.findUnique({ where: { id } })
    if (!existing) throw new AppException('RESOURCE_NOT_FOUND')

    const service = await this.prisma.service.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.unit !== undefined ? { unit: input.unit } : {}),
        ...(input.price !== undefined ? { price: input.price } : {}),
        ...(input.estimatedDays !== undefined ? { estimatedDays: input.estimatedDays } : {}),
        ...(input.description !== undefined ? { description: input.description ?? null } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    })
    return toServiceResponse(service)
  }
}
