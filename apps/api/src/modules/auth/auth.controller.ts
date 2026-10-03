import { Body, Controller, Get, HttpCode, HttpStatus, Post, UsePipes } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { loginSchema, refreshSchema, type LoginInput, type RefreshInput } from '@laundry/shared'
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator'
import { Public } from '../../common/decorators/public.decorator'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { AuthService } from './auth.service'
import { LoginDto, RefreshDto } from './dto/auth.dto'

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Masuk dengan email dan password' })
  @UsePipes(new ZodValidationPipe(loginSchema))
  login(@Body() body: LoginDto) {
    return this.authService.login(body as unknown as LoginInput)
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Perbarui access token' })
  @UsePipes(new ZodValidationPipe(refreshSchema))
  refresh(@Body() body: RefreshDto) {
    return this.authService.refresh(body as unknown as RefreshInput)
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Profil pengguna yang sedang masuk' })
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user.id)
  }
}
