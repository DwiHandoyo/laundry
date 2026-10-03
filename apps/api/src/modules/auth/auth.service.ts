import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService, type JwtSignOptions } from '@nestjs/jwt'
import * as argon2 from 'argon2'
import type { AuthResponse, LoginInput, RefreshInput, UserResponse } from '@laundry/shared'
import { AppException } from '../../common/exceptions/app.exception'
import { PrismaService } from '../../prisma/prisma.service'
import type { JwtPayload } from './jwt.strategy'

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  static hashPassword(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id })
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } })

    // Email tidak terdaftar dan password salah menghasilkan respons yang SAMA PERSIS,
    // supaya tidak membocorkan email mana yang terdaftar.
    if (!user) {
      await argon2.hash('dummy-password-to-equalize-timing')
      throw new AppException('INVALID_CREDENTIALS')
    }

    const valid = await argon2.verify(user.passwordHash, input.password)
    if (!valid) throw new AppException('INVALID_CREDENTIALS')
    if (!user.isActive) throw new AppException('ACCOUNT_INACTIVE')

    return this.issueTokens(user.id, user.email, user.role, user.name)
  }

  async refresh(input: RefreshInput): Promise<AuthResponse> {
    let payload: JwtPayload
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(input.refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      })
    } catch (e) {
      const expired = e instanceof Error && e.name === 'TokenExpiredError'
      throw new AppException(expired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID')
    }

    if (payload.type !== 'refresh') throw new AppException('TOKEN_INVALID')

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } })
    if (!user) throw new AppException('TOKEN_INVALID')
    if (!user.isActive) throw new AppException('ACCOUNT_INACTIVE')

    // Rotasi: token lama tidak dipakai lagi karena client menyimpan yang baru.
    return this.issueTokens(user.id, user.email, user.role, user.name)
  }

  async me(userId: string): Promise<UserResponse> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new AppException('RESOURCE_NOT_FOUND')
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
    }
  }

  private async issueTokens(
    id: string,
    email: string,
    role: UserResponse['role'],
    name: string,
  ): Promise<AuthResponse> {
    const accessExpires = this.config.getOrThrow<string>('JWT_ACCESS_EXPIRES_IN')
    const refreshExpires = this.config.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN')

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(
        { sub: id, email, role, type: 'access' } satisfies JwtPayload,
        {
          secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
          expiresIn: accessExpires as JwtSignOptions['expiresIn'],
        },
      ),
      this.jwt.signAsync(
        { sub: id, email, role, type: 'refresh' } satisfies JwtPayload,
        {
          secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
          expiresIn: refreshExpires as JwtSignOptions['expiresIn'],
        },
      ),
    ])

    return {
      accessToken,
      refreshToken,
      expiresIn: parseDuration(accessExpires),
      user: { id, name, email, role },
    }
  }
}

/** "15m" -> 900 (detik). Dipakai client untuk menjadwalkan refresh. */
export function parseDuration(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim())
  if (!match) return Number(value) || 0
  const amount = Number(match[1])
  const unit = match[2]
  const multiplier = unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400
  return amount * multiplier
}
