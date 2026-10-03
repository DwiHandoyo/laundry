import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { Role } from '@laundry/shared'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: Role
}

/**
 * Menyuntikkan pengguna terautentikasi ke parameter handler,
 * sehingga service tidak perlu tahu apa pun tentang objek Request.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser =>
    ctx.switchToHttp().getRequest<{ user: AuthUser }>().user,
)
