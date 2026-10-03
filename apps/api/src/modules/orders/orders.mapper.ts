import { Prisma } from '@prisma/client'
import type { Role } from '@laundry/shared'
import type { OrderResponse, OrderSummaryResponse } from '@laundry/shared'
import { allowedTransitions } from './order-status.rules'

export const ORDER_FULL_INCLUDE = {
  customer: { select: { id: true, name: true, phone: true } },
  createdBy: { select: { id: true, name: true } },
  items: { orderBy: { createdAt: 'asc' } },
  statusHistory: {
    orderBy: { createdAt: 'desc' },
    include: { changedBy: { select: { id: true, name: true } } },
  },
} satisfies Prisma.OrderInclude

export const ORDER_SUMMARY_INCLUDE = {
  customer: { select: { id: true, name: true, phone: true } },
  items: { select: { quantity: true } },
} satisfies Prisma.OrderInclude

type OrderFull = Prisma.OrderGetPayload<{ include: typeof ORDER_FULL_INCLUDE }>
type OrderSummary = Prisma.OrderGetPayload<{ include: typeof ORDER_SUMMARY_INCLUDE }>

export function toOrderResponse(order: OrderFull, role?: Role): OrderResponse {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    customer: order.customer,
    items: order.items.map((item) => ({
      id: item.id,
      serviceId: item.serviceId,
      serviceName: item.serviceName,
      serviceUnit: item.serviceUnit,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      subtotal: item.subtotal,
      notes: item.notes,
    })),
    subtotal: order.subtotal,
    discount: order.discount,
    total: order.total,
    paidAmount: order.paidAmount,
    notes: order.notes,
    receivedAt: order.receivedAt.toISOString(),
    estimatedDoneAt: order.estimatedDoneAt.toISOString(),
    completedAt: order.completedAt?.toISOString() ?? null,
    cancelledAt: order.cancelledAt?.toISOString() ?? null,
    cancelReason: order.cancelReason,
    createdBy: order.createdBy,
    createdAt: order.createdAt.toISOString(),
    statusHistory: order.statusHistory.map((h) => ({
      id: h.id,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      note: h.note,
      changedBy: h.changedBy,
      createdAt: h.createdAt.toISOString(),
    })),
    // Dihitung server berdasarkan status saat ini DAN peran peminta,
    // supaya mobile tidak perlu menduplikasi tabel transisi.
    ...(role ? { allowedTransitions: allowedTransitions(order.status, role) } : {}),
  }
}

export function toOrderSummaryResponse(order: OrderSummary): OrderSummaryResponse {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    customer: order.customer,
    itemCount: order.items.length,
    totalQuantity: order.items.reduce((sum, i) => sum + i.quantity, 0),
    total: order.total,
    receivedAt: order.receivedAt.toISOString(),
    estimatedDoneAt: order.estimatedDoneAt.toISOString(),
  }
}
