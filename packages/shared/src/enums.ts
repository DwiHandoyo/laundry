/**
 * Enum domain — sumber kebenaran tunggal yang dipakai backend dan mobile.
 * Harus selalu identik dengan enum di prisma/schema.prisma.
 *
 * Tiap enum didefinisikan sebagai tuple `as const` lebih dulu supaya
 * z.enum() menghasilkan literal union (bukan `string`), lalu objeknya
 * diturunkan dari tuple itu agar keduanya tidak mungkin melenceng.
 */

export const ROLE_VALUES = ['OWNER', 'STAFF'] as const
export type Role = (typeof ROLE_VALUES)[number]
export const Role = { OWNER: 'OWNER', STAFF: 'STAFF' } as const satisfies Record<Role, Role>

export const SERVICE_CATEGORY_VALUES = ['SHOE_LAUNDRY', 'REPAINT', 'REGLUE', 'OTHER'] as const
export type ServiceCategory = (typeof SERVICE_CATEGORY_VALUES)[number]
export const ServiceCategory = {
  SHOE_LAUNDRY: 'SHOE_LAUNDRY',
  REPAINT: 'REPAINT',
  REGLUE: 'REGLUE',
  OTHER: 'OTHER',
} as const satisfies Record<ServiceCategory, ServiceCategory>

export const SERVICE_UNIT_VALUES = ['PAIR', 'ITEM', 'KG'] as const
export type ServiceUnit = (typeof SERVICE_UNIT_VALUES)[number]
export const ServiceUnit = {
  PAIR: 'PAIR',
  ITEM: 'ITEM',
  KG: 'KG',
} as const satisfies Record<ServiceUnit, ServiceUnit>

export const ORDER_STATUS_VALUES = [
  'RECEIVED',
  'IN_PROGRESS',
  'READY',
  'COMPLETED',
  'CANCELLED',
] as const
export type OrderStatus = (typeof ORDER_STATUS_VALUES)[number]
export const OrderStatus = {
  RECEIVED: 'RECEIVED',
  IN_PROGRESS: 'IN_PROGRESS',
  READY: 'READY',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const satisfies Record<OrderStatus, OrderStatus>

export const PAYMENT_STATUS_VALUES = ['UNPAID', 'PARTIAL', 'PAID'] as const
export type PaymentStatus = (typeof PAYMENT_STATUS_VALUES)[number]
export const PaymentStatus = {
  UNPAID: 'UNPAID',
  PARTIAL: 'PARTIAL',
  PAID: 'PAID',
} as const satisfies Record<PaymentStatus, PaymentStatus>

export const PAYMENT_METHOD_VALUES = ['CASH', 'TRANSFER'] as const
export type PaymentMethod = (typeof PAYMENT_METHOD_VALUES)[number]
export const PaymentMethod = {
  CASH: 'CASH',
  TRANSFER: 'TRANSFER',
} as const satisfies Record<PaymentMethod, PaymentMethod>
