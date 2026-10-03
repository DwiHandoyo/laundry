import { Injectable } from '@nestjs/common'
import type { User } from '@prisma/client'
import type { CreateUserInput, UpdateUserInput, UserResponse } from '@laundry/shared'
import { AppException } from '../../common/exceptions/app.exception'
import { normalizePhone } from '../../common/utils/phone'
import { PrismaService } from '../../prisma/prisma.service'
import { AuthService } from '../auth/auth.service'

/** passwordHash sengaja tidak pernah ikut — mapper ini satu-satunya jalan keluar entity User. */
export function toUserResponse(u: User): UserResponse {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    isActive: u.isActive,
  }
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<{ data: UserResponse[] }> {
    const users = await this.prisma.user.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    })
    return { data: users.map(toUserResponse) }
  }

  async create(input: CreateUserInput): Promise<UserResponse> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } })
    if (existing) throw new AppException('USER_EMAIL_TAKEN')

    const user = await this.prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone ? normalizePhone(input.phone) : null,
        passwordHash: await AuthService.hashPassword(input.password),
        role: input.role,
      },
    })
    return toUserResponse(user)
  }

  /** Akun tidak pernah dihapus, hanya isActive=false, agar Order.createdById tetap utuh. */
  async update(id: string, input: UpdateUserInput): Promise<UserResponse> {
    const existing = await this.prisma.user.findUnique({ where: { id } })
    if (!existing) throw new AppException('RESOURCE_NOT_FOUND')

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.phone !== undefined
          ? { phone: input.phone ? normalizePhone(input.phone) : null }
          : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    })
    return toUserResponse(user)
  }
}
