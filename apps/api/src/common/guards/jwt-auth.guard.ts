import { ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthGuard } from '@nestjs/passport'
import { TokenExpiredError } from 'jsonwebtoken'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'
import { AppException } from '../exceptions/app.exception'

/**
 * Terpasang global. Defaultnya aman: lupa memasang guard
 * tidak akan membuat endpoint terbuka — yang terbuka harus ditandai @Public().
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super()
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true
    return super.canActivate(context)
  }

  handleRequest<TUser>(err: unknown, user: TUser, info: unknown): TUser {
    if (info instanceof TokenExpiredError) throw new AppException('TOKEN_EXPIRED')
    if (err || !user) throw new AppException('TOKEN_INVALID')
    return user
  }
}
