import { Module } from '@nestjs/common'
import { OrderNumberService } from './order-number.service'
import { OrdersController } from './orders.controller'
import { OrdersService } from './orders.service'

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, OrderNumberService],
  exports: [OrdersService],
})
export class OrdersModule {}
