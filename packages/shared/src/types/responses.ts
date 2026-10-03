import type {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Role,
  ServiceCategory,
  ServiceUnit,
} from '../enums'

export interface UserResponse {
  id: string
  name: string
  email: string
  phone: string | null
  role: Role
  isActive: boolean
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: Pick<UserResponse, 'id' | 'name' | 'email' | 'role'>
}

export interface ServiceResponse {
  id: string
  code: string
  name: string
  category: ServiceCategory
  unit: ServiceUnit
  price: number
  estimatedDays: number
  description: string | null
  isActive: boolean
}

export interface CustomerResponse {
  id: string
  name: string
  phone: string
  notes: string | null
  orderCount?: number
  lastOrderAt?: string | null
  createdAt: string
}

export interface OrderItemResponse {
  id: string
  serviceId: string
  serviceName: string
  serviceUnit: ServiceUnit
  unitPrice: number
  quantity: number
  subtotal: number
  notes: string | null
}

export interface OrderStatusHistoryResponse {
  id: string
  fromStatus: OrderStatus | null
  toStatus: OrderStatus
  note: string | null
  changedBy: { id: string; name: string }
  createdAt: string
}

export interface OrderSummaryResponse {
  id: string
  orderNumber: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  customer: { id: string; name: string; phone: string }
  itemCount: number
  totalQuantity: number
  total: number
  receivedAt: string
  estimatedDoneAt: string
}

export interface OrderResponse {
  id: string
  orderNumber: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  paymentMethod: PaymentMethod | null
  customer: { id: string; name: string; phone: string }
  items: OrderItemResponse[]
  subtotal: number
  discount: number
  total: number
  paidAmount: number
  notes: string | null
  receivedAt: string
  estimatedDoneAt: string
  completedAt: string | null
  cancelledAt: string | null
  cancelReason: string | null
  createdBy: { id: string; name: string }
  createdAt: string
  statusHistory?: OrderStatusHistoryResponse[]
  allowedTransitions?: OrderStatus[]
}

export interface PaymentResponse {
  id: string
  total: number
  paidAmount: number
  paymentStatus: PaymentStatus
  paymentMethod: PaymentMethod | null
}

export interface DailySummaryResponse {
  date: string
  ordersByStatus: Record<OrderStatus, number>
  newOrders: number
  completedOrders: number
  revenue: {
    billed: number
    collected: number
    outstanding: number
  }
  topServices: Array<{
    serviceId: string
    serviceName: string
    quantity: number
    revenue: number
  }>
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface Paginated<T> {
  data: T[]
  meta: PaginationMeta
}

export interface ApiErrorResponse {
  statusCode: number
  code: string
  message: string
  details?: Record<string, unknown>
}
