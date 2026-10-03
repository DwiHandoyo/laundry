import { OrderStatus, PaymentStatus, Role } from '@laundry/shared'
import { AppException } from '../../common/exceptions/app.exception'

/**
 * Satu-satunya sumber aturan transisi status.
 * Dipakai untuk memvalidasi request masuk DAN untuk mengisi field
 * `allowedTransitions` pada response detail pesanan yang dibaca mobile —
 * sehingga UI dan penegakan server tidak mungkin berbeda.
 */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.RECEIVED]: [OrderStatus.IN_PROGRESS, OrderStatus.CANCELLED],
  [OrderStatus.IN_PROGRESS]: [OrderStatus.READY, OrderStatus.CANCELLED],
  [OrderStatus.READY]: [OrderStatus.COMPLETED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
}

/** Transisi yang menuntut peran tertentu. */
const ROLE_RESTRICTED: Array<{ from: OrderStatus; to: OrderStatus; role: Role }> = [
  // Membatalkan pekerjaan yang sudah berjalan: bahan dan waktu kerja sudah terpakai.
  { from: OrderStatus.IN_PROGRESS, to: OrderStatus.CANCELLED, role: Role.OWNER },
]

export function isFinalStatus(status: OrderStatus): boolean {
  return TRANSITIONS[status].length === 0
}

export function allowedTransitions(current: OrderStatus, role: Role): OrderStatus[] {
  return TRANSITIONS[current].filter(
    (to) =>
      !ROLE_RESTRICTED.some((r) => r.from === current && r.to === to && r.role !== role),
  )
}

export function assertTransitionAllowed(
  order: { status: OrderStatus; paymentStatus: PaymentStatus },
  to: OrderStatus,
  role: Role,
): void {
  if (isFinalStatus(order.status)) {
    throw new AppException('ORDER_ALREADY_FINAL', { currentStatus: order.status })
  }

  if (!TRANSITIONS[order.status].includes(to)) {
    throw new AppException('ORDER_INVALID_TRANSITION', {
      currentStatus: order.status,
      requestedStatus: to,
    })
  }

  if (!allowedTransitions(order.status, role).includes(to)) {
    throw new AppException('FORBIDDEN_ROLE', {
      currentStatus: order.status,
      requestedStatus: to,
    })
  }

  // Sepatu tidak diserahkan sebelum dibayar.
  if (to === OrderStatus.COMPLETED && order.paymentStatus !== PaymentStatus.PAID) {
    throw new AppException('ORDER_NOT_FULLY_PAID')
  }
}
