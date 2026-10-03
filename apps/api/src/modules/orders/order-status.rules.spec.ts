import { OrderStatus, PaymentStatus, Role } from '@laundry/shared'
import { AppException } from '../../common/exceptions/app.exception'
import { allowedTransitions, assertTransitionAllowed, isFinalStatus } from './order-status.rules'

const paid = { paymentStatus: PaymentStatus.PAID }
const unpaid = { paymentStatus: PaymentStatus.UNPAID }

function expectCode(fn: () => void, code: string): void {
  try {
    fn()
    fail(`seharusnya melempar ${code}`)
  } catch (e) {
    expect(e).toBeInstanceOf(AppException)
    expect((e as AppException).code).toBe(code)
  }
}

describe('invariant #9: setiap transisi valid diterima', () => {
  const valid: Array<[OrderStatus, OrderStatus, Role]> = [
    [OrderStatus.RECEIVED, OrderStatus.IN_PROGRESS, Role.STAFF],
    [OrderStatus.RECEIVED, OrderStatus.CANCELLED, Role.STAFF],
    [OrderStatus.RECEIVED, OrderStatus.CANCELLED, Role.OWNER],
    [OrderStatus.IN_PROGRESS, OrderStatus.READY, Role.STAFF],
    [OrderStatus.IN_PROGRESS, OrderStatus.CANCELLED, Role.OWNER],
  ]

  it.each(valid)('%s -> %s sebagai %s', (from, to, role) => {
    expect(() => assertTransitionAllowed({ status: from, ...unpaid }, to, role)).not.toThrow()
  })

  it('READY -> COMPLETED saat lunas', () => {
    expect(() =>
      assertTransitionAllowed({ status: OrderStatus.READY, ...paid }, OrderStatus.COMPLETED, Role.STAFF),
    ).not.toThrow()
  })
})

describe('invariant #9: setiap transisi tidak valid ditolak', () => {
  const invalid: Array<[OrderStatus, OrderStatus]> = [
    [OrderStatus.RECEIVED, OrderStatus.READY],
    [OrderStatus.RECEIVED, OrderStatus.COMPLETED],
    [OrderStatus.IN_PROGRESS, OrderStatus.COMPLETED],
    [OrderStatus.IN_PROGRESS, OrderStatus.RECEIVED],
    [OrderStatus.READY, OrderStatus.IN_PROGRESS],
    [OrderStatus.READY, OrderStatus.CANCELLED],
  ]

  it.each(invalid)('%s -> %s ditolak', (from, to) => {
    expectCode(
      () => assertTransitionAllowed({ status: from, ...paid }, to, Role.OWNER),
      'ORDER_INVALID_TRANSITION',
    )
  })

  it('tidak ada transisi mundur dari status mana pun', () => {
    expectCode(
      () => assertTransitionAllowed({ status: OrderStatus.READY, ...paid }, OrderStatus.RECEIVED, Role.OWNER),
      'ORDER_INVALID_TRANSITION',
    )
  })
})

describe('status akhir', () => {
  it('COMPLETED dan CANCELLED bersifat terminal', () => {
    expect(isFinalStatus(OrderStatus.COMPLETED)).toBe(true)
    expect(isFinalStatus(OrderStatus.CANCELLED)).toBe(true)
    expect(allowedTransitions(OrderStatus.COMPLETED, Role.OWNER)).toEqual([])
  })

  it.each([OrderStatus.COMPLETED, OrderStatus.CANCELLED])('%s menolak perubahan apa pun', (s) => {
    expectCode(
      () => assertTransitionAllowed({ status: s, ...paid }, OrderStatus.IN_PROGRESS, Role.OWNER),
      'ORDER_ALREADY_FINAL',
    )
  })
})

describe('READY -> COMPLETED menuntut lunas', () => {
  it.each([PaymentStatus.UNPAID, PaymentStatus.PARTIAL])('ditolak saat %s', (paymentStatus) => {
    expectCode(
      () =>
        assertTransitionAllowed({ status: OrderStatus.READY, paymentStatus }, OrderStatus.COMPLETED, Role.OWNER),
      'ORDER_NOT_FULLY_PAID',
    )
  })
})

describe('pembatalan dari IN_PROGRESS dibatasi peran', () => {
  it('ditolak untuk STAFF', () => {
    expectCode(
      () =>
        assertTransitionAllowed({ status: OrderStatus.IN_PROGRESS, ...unpaid }, OrderStatus.CANCELLED, Role.STAFF),
      'FORBIDDEN_ROLE',
    )
  })

  it('diterima untuk OWNER', () => {
    expect(() =>
      assertTransitionAllowed({ status: OrderStatus.IN_PROGRESS, ...unpaid }, OrderStatus.CANCELLED, Role.OWNER),
    ).not.toThrow()
  })

  it('allowedTransitions menyembunyikannya dari STAFF', () => {
    expect(allowedTransitions(OrderStatus.IN_PROGRESS, Role.STAFF)).toEqual([OrderStatus.READY])
    expect(allowedTransitions(OrderStatus.IN_PROGRESS, Role.OWNER)).toEqual([
      OrderStatus.READY,
      OrderStatus.CANCELLED,
    ])
  })
})
