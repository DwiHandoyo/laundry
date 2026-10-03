import { Controller, Get } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Public } from '../../common/decorators/public.decorator'
import { PrismaService } from '../../prisma/prisma.service'

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Proses hidup' })
  liveness() {
    return { status: 'ok' }
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Database terjangkau' })
  async readiness() {
    try {
      await this.prisma.$queryRaw`SELECT 1`
      return { status: 'ok', database: 'ok' }
    } catch {
      return { status: 'error', database: 'error' }
    }
  }
}
