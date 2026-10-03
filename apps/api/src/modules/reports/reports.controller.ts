import { Controller, Get, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Role, dailySummaryQuerySchema, type DailySummaryQueryInput } from '@laundry/shared'
import { Roles } from '../../common/decorators/roles.decorator'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { ReportsService } from './reports.service'

@ApiTags('reports')
@ApiBearerAuth()
@Roles(Role.OWNER)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('daily-summary')
  @ApiOperation({ summary: 'Rekap harian (OWNER). Batas hari mengikuti Asia/Jakarta.' })
  dailySummary(
    @Query(new ZodValidationPipe(dailySummaryQuerySchema)) query: DailySummaryQueryInput,
  ) {
    return this.reportsService.dailySummary(query.date)
  }
}
