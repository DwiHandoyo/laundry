import { PaymentStatus, ServiceUnit } from '@laundry/shared'
import { AppException } from '../../common/exceptions/app.exception'
import {
  assertAllServicesActive,
  assertAllServicesFound,
  buildOrderItems,
  calculateEstimatedDoneAt,
  calculateOrderTotals,
  derivePaymentStatus,
  type ServiceSnapshot,
} from './order-pricing'

const wash: ServiceSnapshot = {
  id: 'aaaaaaaa-0000-4000-8000-000000000001',
  name: 'Cuci Sepatu Reguler',
  unit: ServiceUnit.PAIR,
  price: 35_000,
  estimatedDays: 3,
  isActive: true,
}
const repaint: ServiceSnapshot = {
  id: 'aaaaaaaa-0000-4000-8000-000000000002',
  name: 'Repaint Full',
  unit: ServiceUnit.PAIR,
  price: 150_000,
  estimatedDays: 7,
  isActive: true,
}

describe('buildOrderItems — invariant #3: subtotal item = unitPrice x quantity', () => {
  it('menghitung subtotal per baris', () => {
    const items = buildOrderItems([{ serviceId: wash.id, quantity: 2 }], [wash])
    expect(items[0].subtotal).toBe(70_000)
    expect(items[0].unitPrice).toBe(35_000)
  })

  it('menyalin nama dan satuan sebagai snapshot', () => {
    const items = buildOrderItems([{ serviceId: wash.id, quantity: 1 }], [wash])
    expect(items[0].serviceName).toBe('Cuci Sepatu Reguler')
    expect(items[0].serviceUnit).toBe(ServiceUnit.PAIR)
  })

  it('quantity 1 menghasilkan subtotal sama dengan harga satuan', () => {
    const items = buildOrderItems([{ serviceId: repaint.id, quantity: 1 }], [repaint])
    expect(items[0].subtotal).toBe(150_000)
  })
})

describe('calculateOrderTotals — invariant #2: total = subtotal - discount', () => {
  const items = buildOrderItems(
    [
      { serviceId: wash.id, quantity: 2 },
      { serviceId: repaint.id, quantity: 1 },
    ],
    [wash, repaint],
  )

  it('tanpa diskon', () => {
    expect(calculateOrderTotals(items, 0)).toEqual({
      subtotal: 220_000,
      discount: 0,
      total: 220_000,
    })
  })

  it('dengan diskon', () => {
    expect(calculateOrderTotals(items, 20_000)).toEqual({
      subtotal: 220_000,
      discount: 20_000,
      total: 200_000,
    })
  })

  it('diskon sama dengan subtotal menghasilkan total 0', () => {
    expect(calculateOrderTotals(items, 220_000).total).toBe(0)
  })

  it('invariant #5: diskon melebihi subtotal ditolak', () => {
    expect(() => calculateOrderTotals(items, 220_001)).toThrow(AppException)
    try {
      calculateOrderTotals(items, 999_999)
    } catch (e) {
      expect((e as AppException).code).toBe('DISCOUNT_EXCEEDS_SUBTOTAL')
    }
  })
})

describe('derivePaymentStatus — invariant #7, diuji pada tiga batas', () => {
  it('0 -> UNPAID', () => {
    expect(derivePaymentStatus(0, 120_000)).toBe(PaymentStatus.UNPAID)
  })

  it('kurang dari total -> PARTIAL', () => {
    expect(derivePaymentStatus(60_000, 120_000)).toBe(PaymentStatus.PARTIAL)
    expect(derivePaymentStatus(119_999, 120_000)).toBe(PaymentStatus.PARTIAL)
  })

  it('sama dengan total -> PAID', () => {
    expect(derivePaymentStatus(120_000, 120_000)).toBe(PaymentStatus.PAID)
  })

  it('pesanan bertotal 0 langsung PAID saat dibayar', () => {
    expect(derivePaymentStatus(0, 0)).toBe(PaymentStatus.UNPAID)
    expect(derivePaymentStatus(1, 0)).toBe(PaymentStatus.PAID)
  })
})

describe('calculateEstimatedDoneAt', () => {
  it('memakai estimatedDays TERBESAR dari seluruh item', () => {
    const receivedAt = new Date('2026-08-22T02:00:00.000Z')
    const result = calculateEstimatedDoneAt([wash, repaint], receivedAt)
    expect(result.toISOString()).toBe('2026-08-29T02:00:00.000Z')
  })

  it('layanan express 1 hari', () => {
    const receivedAt = new Date('2026-08-22T02:00:00.000Z')
    const express = { ...wash, estimatedDays: 1 }
    expect(calculateEstimatedDoneAt([express], receivedAt).toISOString()).toBe(
      '2026-08-23T02:00:00.000Z',
    )
  })
})

describe('penjagaan layanan', () => {
  it('invariant #12: layanan nonaktif ditolak', () => {
    const inactive = { ...wash, isActive: false }
    try {
      assertAllServicesActive([inactive])
      fail('seharusnya melempar')
    } catch (e) {
      expect((e as AppException).code).toBe('SERVICE_INACTIVE')
      expect((e as AppException).details).toEqual({ serviceIds: [inactive.id] })
    }
  })

  it('serviceId yang tidak ada ditolak', () => {
    try {
      assertAllServicesFound([], [{ serviceId: 'hilang', quantity: 1 }])
      fail('seharusnya melempar')
    } catch (e) {
      expect((e as AppException).code).toBe('RESOURCE_NOT_FOUND')
    }
  })
})
