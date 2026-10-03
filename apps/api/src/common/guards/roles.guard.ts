import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Role } from '@laundry/shared'
import { ROLES_KEY } from '../decorators/roles.decorator'
import type { AuthUser } from '../decorators/current-user.decorator'
import { AppException } from '../exceptions/app.exception'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!required || required.length === 0) return true

    const user = context.switchToHttp().getRequest<{ user?: AuthUser }>().user
    if (!user) throw new AppException('TOKEN_INVALID')
    if (!required.includes(user.role)) throw new AppException('FORBIDDEN_ROLE')
    return true
  }
}
