import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import type { Role } from '@laundry/shared'
import type { AuthUser } from '../../common/decorators/current-user.decorator'
import { AppException } from '../../common/exceptions/app.exception'
import { PrismaService } from '../../prisma/prisma.service'

export interface JwtPayload {
  sub: string
  email: string
  role: Role
  type: 'access' | 'refresh'
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    })
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (payload.type !== 'access') throw new AppException('TOKEN_INVALID')

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } })
    if (!user) throw new AppException('TOKEN_INVALID')
    if (!user.isActive) throw new AppException('ACCOUNT_INACTIVE')

    return { id: user.id, email: user.email, name: user.name, role: user.role }
  }
}
