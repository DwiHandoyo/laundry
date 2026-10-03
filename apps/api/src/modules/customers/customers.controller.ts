import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import {
  createCustomerSchema,
  queryCustomersSchema,
  updateCustomerSchema,
  type CreateCustomerInput,
  type QueryCustomersInput,
  type UpdateCustomerInput,
} from '@laundry/shared'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { CustomersService } from './customers.service'

@ApiTags('customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @ApiOperation({ summary: 'Daftar pelanggan, cari lewat nama atau nomor HP' })
  findAll(@Query(new ZodValidationPipe(queryCustomersSchema)) query: QueryCustomersInput) {
    return this.customersService.findAll(query)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail pelanggan + 5 pesanan terakhir' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.findOne(id)
  }

  @Post()
  @ApiOperation({ summary: 'Tambah pelanggan' })
  create(@Body(new ZodValidationPipe(createCustomerSchema)) body: CreateCustomerInput) {
    return this.customersService.create(body)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Ubah pelanggan' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateCustomerSchema)) body: UpdateCustomerInput,
  ) {
    return this.customersService.update(id, body)
  }
}
