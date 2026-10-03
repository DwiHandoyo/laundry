import { PaymentStatus, type ServiceUnit } from '@laundry/shared'
import { AppException } from '../../common/exceptions/app.exception'
import { addDays } from '../../common/utils/date'

export interface PricedItem {
  serviceId: string
  serviceName: string
  serviceUnit: ServiceUnit
  unitPrice: number
  quantity: number
  subtotal: number
  notes: string | null
}

export interface ServiceSnapshot {
  id: string
  name: string
  unit: ServiceUnit
  price: number
  estimatedDays: number
  isActive: boolean
}

export interface ItemInput {
  serviceId: string
  quantity: number
  notes?: string | null
}

/**
 * Membangun baris item dengan SNAPSHOT nama, satuan, dan harga.
 * Harga selalu berasal dari master Service — tidak pernah dari kiriman client.
 */
export function buildOrderItems(
  inputs: ItemInput[],
  services: ServiceSnapshot[],
): PricedItem[] {
  const byId = new Map(services.map((s) => [s.id, s]))

  return inputs.map((input) => {
    const service = byId.get(input.serviceId)
    if (!service) throw new AppException('RESOURCE_NOT_FOUND', { serviceId: input.serviceId })

    return {
      serviceId: service.id,
      serviceName: service.name,
      serviceUnit: service.unit,
      unitPrice: service.price,
      quantity: input.quantity,
      subtotal: service.price * input.quantity,
      notes: input.notes ?? null,
    }
  })
}

export interface OrderTotals {
  subtotal: number
  discount: number
  total: number
}

/** subtotal = Σ item.subtotal ; total = subtotal − discount */
export function calculateOrderTotals(items: PricedItem[], discount: number): OrderTotals {
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0)
  if (discount > subtotal) {
    throw new AppException('DISCOUNT_EXCEEDS_SUBTOTAL', { subtotal, discount })
  }
  return { subtotal, discount, total: subtotal - discount }
}

/** estimatedDoneAt = receivedAt + max(estimatedDays dari seluruh layanan yang dipesan) */
export function calculateEstimatedDoneAt(services: ServiceSnapshot[], receivedAt: Date): Date {
  const maxDays = services.reduce((max, s) => Math.max(max, s.estimatedDays), 0)
  return addDays(receivedAt, maxDays)
}

/**
 * paymentStatus SELALU turunan dari paidAmount vs total.
 * Tidak ada tempat lain yang boleh menetapkannya langsung.
 */
export function derivePaymentStatus(paidAmount: number, total: number): PaymentStatus {
  if (paidAmount <= 0) return PaymentStatus.UNPAID
  if (paidAmount >= total) return PaymentStatus.PAID
  return PaymentStatus.PARTIAL
}

export function assertAllServicesFound(
  services: ServiceSnapshot[],
  inputs: ItemInput[],
): void {
  const found = new Set(services.map((s) => s.id))
  const missing = [...new Set(inputs.map((i) => i.serviceId))].filter((id) => !found.has(id))
  if (missing.length > 0) {
    throw new AppException('RESOURCE_NOT_FOUND', { serviceIds: missing })
  }
}

export function assertAllServicesActive(services: ServiceSnapshot[]): void {
  const inactive = services.filter((s) => !s.isActive).map((s) => s.id)
  if (inactive.length > 0) {
    throw new AppException('SERVICE_INACTIVE', { serviceIds: inactive })
  }
}
