import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import {
  createOrderSchema,
  queryOrdersSchema,
  recordPaymentSchema,
  updateOrderStatusSchema,
  type CreateOrderInput,
  type QueryOrdersInput,
  type RecordPaymentInput,
  type UpdateOrderStatusInput,
} from '@laundry/shared'
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { OrdersService } from './orders.service'

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Buat pesanan baru' })
  create(
    @Body(new ZodValidationPipe(createOrderSchema)) body: CreateOrderInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ordersService.create(body, user)
  }

  @Get()
  @ApiOperation({ summary: 'Daftar pesanan dengan filter status, tanggal, dan pencarian' })
  findAll(@Query(new ZodValidationPipe(queryOrdersSchema)) query: QueryOrdersInput) {
    return this.ordersService.findAll(query)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail pesanan + riwayat status + transisi yang diizinkan' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.ordersService.findOne(id, user)
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Ubah status pesanan' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateOrderStatusSchema)) body: UpdateOrderStatusInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ordersService.updateStatus(id, body, user)
  }

  @Patch(':id/payment')
  @ApiOperation({ summary: 'Catat pembayaran' })
  recordPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(recordPaymentSchema)) body: RecordPaymentInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ordersService.recordPayment(id, body, user)
  }
}
