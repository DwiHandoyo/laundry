import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import {
  Role,
  createServiceSchema,
  queryServicesSchema,
  updateServiceSchema,
  type CreateServiceInput,
  type QueryServicesInput,
  type UpdateServiceInput,
} from '@laundry/shared'
import { Roles } from '../../common/decorators/roles.decorator'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { ServicesService } from './services.service'

@ApiTags('services')
@ApiBearerAuth()
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  @ApiOperation({ summary: 'Daftar layanan' })
  findAll(@Query(new ZodValidationPipe(queryServicesSchema)) query: QueryServicesInput) {
    return this.servicesService.findAll(query)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail layanan' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicesService.findOne(id)
  }

  @Post()
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'Tambah layanan (OWNER)' })
  create(@Body(new ZodValidationPipe(createServiceSchema)) body: CreateServiceInput) {
    return this.servicesService.create(body)
  }

  @Patch(':id')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'Ubah layanan (OWNER)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateServiceSchema)) body: UpdateServiceInput,
  ) {
    return this.servicesService.update(id, body)
  }
}
