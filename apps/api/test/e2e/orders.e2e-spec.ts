import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { OrderStatus, PaymentStatus } from '@laundry/shared'
import { PrismaService } from '../../src/prisma/prisma.service'
import { API, bootstrapTestApp, seedUsersAndServices } from './helpers'

describe('Orders (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let ownerToken: string
  let staffToken: string
  let washId: string
  let glueId: string
  let retiredId: string

  const login = async (email: string): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .send({ email, password: 'rahasia123' })
      .expect(200)
    return res.body.accessToken
  }

  beforeAll(async () => {
    app = await bootstrapTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(async () => {
    const seeded = await seedUsersAndServices(app)
    prisma = seeded.prisma
    washId = seeded.wash.id
    glueId = seeded.glue.id
    retiredId = seeded.retired.id
    ownerToken = await login('owner@test.id')
    staffToken = await login('staff@test.id')
  })

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

  const createOrder = (token: string, body: Record<string, unknown>) =>
    request(app.getHttpServer()).post(`${API}/orders`).set(auth(token)).send(body)

  const baseOrder = () => ({
    customer: { name: 'Andi Wijaya', phone: '0812-3456-7890' },
    items: [
      { serviceId: washId, quantity: 2, notes: 'Nike AF1 putih' },
      { serviceId: glueId, quantity: 1 },
    ],
  })

  // ── Alur penuh ────────────────────────────────────────────────────────────
  it('alur penuh: buat -> IN_PROGRESS -> READY -> bayar -> COMPLETED', async () => {
    const created = await createOrder(staffToken, baseOrder()).expect(201)
    const id = created.body.id

    expect(created.body.orderNumber).toMatch(/^LDY-\d{8}-\d{3}$/)
    expect(created.body.status).toBe(OrderStatus.RECEIVED)
    expect(created.body.paymentStatus).toBe(PaymentStatus.UNPAID)
    expect(created.body.subtotal).toBe(120_000)
    expect(created.body.total).toBe(120_000)
    expect(created.body.customer.phone).toBe('+6281234567890')
    expect(created.body.statusHistory).toHaveLength(1)
    expect(created.body.statusHistory[0].fromStatus).toBeNull()

    const patch = (status: string, note?: string) =>
      request(app.getHttpServer())
        .patch(`${API}/orders/${id}/status`)
        .set(auth(staffToken))
        .send({ status, note })

    await patch(OrderStatus.IN_PROGRESS).expect(200)
    await patch(OrderStatus.READY).expect(200)

    await request(app.getHttpServer())
      .patch(`${API}/orders/${id}/payment`)
      .set(auth(staffToken))
      .send({ amount: 120_000, method: 'CASH' })
      .expect(200)

    const done = await patch(OrderStatus.COMPLETED).expect(200)
    expect(done.body.status).toBe(OrderStatus.COMPLETED)
    expect(done.body.completedAt).not.toBeNull()
    expect(done.body.allowedTransitions).toEqual([])

    // Invariant #10: setiap perubahan status menghasilkan satu entri riwayat
    expect(done.body.statusHistory).toHaveLength(4)
  })

  // ── Kasus wajib #5 ────────────────────────────────────────────────────────
  it('READY -> COMPLETED ditolak saat belum lunas', async () => {
    const created = await createOrder(staffToken, baseOrder()).expect(201)
    const id = created.body.id
    const patch = (status: string) =>
      request(app.getHttpServer())
        .patch(`${API}/orders/${id}/status`)
        .set(auth(staffToken))
        .send({ status })

    await patch(OrderStatus.IN_PROGRESS).expect(200)
    await patch(OrderStatus.READY).expect(200)

    const rejected = await patch(OrderStatus.COMPLETED).expect(422)
    expect(rejected.body.code).toBe('ORDER_NOT_FULLY_PAID')

    // DP saja belum cukup
    await request(app.getHttpServer())
      .patch(`${API}/orders/${id}/payment`)
      .set(auth(staffToken))
      .send({ amount: 60_000, method: 'CASH' })
      .expect(200)
    expect((await patch(OrderStatus.COMPLETED).expect(422)).body.code).toBe('ORDER_NOT_FULLY_PAID')
  })

  // ── Kasus wajib #6 ────────────────────────────────────────────────────────
  it('pembatalan dari IN_PROGRESS ditolak untuk STAFF, diterima untuk OWNER', async () => {
    const created = await createOrder(staffToken, baseOrder()).expect(201)
    const id = created.body.id

    await request(app.getHttpServer())
      .patch(`${API}/orders/${id}/status`)
      .set(auth(staffToken))
      .send({ status: OrderStatus.IN_PROGRESS })
      .expect(200)

    const asStaff = await request(app.getHttpServer())
      .patch(`${API}/orders/${id}/status`)
      .set(auth(staffToken))
      .send({ status: OrderStatus.CANCELLED, note: 'coba batal' })
      .expect(403)
    expect(asStaff.body.code).toBe('FORBIDDEN_ROLE')

    const asOwner = await request(app.getHttpServer())
      .patch(`${API}/orders/${id}/status`)
      .set(auth(ownerToken))
      .send({ status: OrderStatus.CANCELLED, note: 'pelanggan membatalkan' })
      .expect(200)
    expect(asOwner.body.status).toBe(OrderStatus.CANCELLED)
    expect(asOwner.body.cancelReason).toBe('pelanggan membatalkan')
  })

  it('pembatalan wajib menyertakan alasan', async () => {
    const created = await createOrder(staffToken, baseOrder()).expect(201)
    const res = await request(app.getHttpServer())
      .patch(`${API}/orders/${created.body.id}/status`)
      .set(auth(staffToken))
      .send({ status: OrderStatus.CANCELLED })
      .expect(400)
    expect(res.body.code).toBe('VALIDATION_FAILED')
  })

  // ── Kasus wajib #7 ────────────────────────────────────────────────────────
  it('layanan nonaktif menolak SELURUH pesanan — tidak ada Order parsial yang tersimpan', async () => {
    const before = await prisma.order.count()

    const res = await createOrder(staffToken, {
      customer: { name: 'Rina', phone: '081298765432' },
      items: [
        { serviceId: washId, quantity: 1 },
        { serviceId: retiredId, quantity: 1 },
      ],
    }).expect(422)

    expect(res.body.code).toBe('SERVICE_INACTIVE')
    expect(res.body.details.serviceIds).toEqual([retiredId])

    expect(await prisma.order.count()).toBe(before)
    expect(await prisma.orderItem.count()).toBe(0)
    expect(await prisma.orderStatusHistory.count()).toBe(0)
  })

  it('pesanan tanpa item ditolak dengan ORDER_EMPTY_ITEMS', async () => {
    const res = await createOrder(staffToken, {
      customer: { name: 'Rina', phone: '081298765432' },
      items: [],
    }).expect(422)
    expect(res.body.code).toBe('ORDER_EMPTY_ITEMS')
    expect(await prisma.order.count()).toBe(0)
  })

  // ── Kasus wajib #8 ────────────────────────────────────────────────────────
  it('20 pembuatan pesanan bersamaan menghasilkan 20 orderNumber yang berbeda', async () => {
    const customer = await prisma.customer.create({
      data: { name: 'Pelanggan Uji', phone: '+6281200000000' },
    })

    const responses = await Promise.all(
      Array.from({ length: 20 }, () =>
        createOrder(staffToken, {
          customerId: customer.id,
          items: [{ serviceId: washId, quantity: 1 }],
        }),
      ),
    )

    responses.forEach((r) => expect(r.status).toBe(201))
    const numbers = responses.map((r) => r.body.orderNumber as string)
    expect(new Set(numbers).size).toBe(20)
    numbers.forEach((n) => expect(n).toMatch(/^LDY-\d{8}-\d{3}$/))
  })

  // ── Kasus wajib #9 ────────────────────────────────────────────────────────
  it('mengubah harga layanan TIDAK mengubah total pesanan yang sudah ada', async () => {
    const created = await createOrder(staffToken, baseOrder()).expect(201)
    const id = created.body.id
    expect(created.body.total).toBe(120_000)

    await request(app.getHttpServer())
      .patch(`${API}/services/${washId}`)
      .set(auth(ownerToken))
      .send({ price: 99_000 })
      .expect(200)

    const after = await request(app.getHttpServer())
      .get(`${API}/orders/${id}`)
      .set(auth(staffToken))
      .expect(200)

    expect(after.body.total).toBe(120_000)
    expect(after.body.subtotal).toBe(120_000)
    expect(after.body.items[0].unitPrice).toBe(35_000)
    expect(after.body.items[0].serviceName).toBe('Cuci Sepatu Reguler')

    // Pesanan BARU memakai harga baru
    const fresh = await createOrder(staffToken, {
      customer: { name: 'Rina', phone: '081298765432' },
      items: [{ serviceId: washId, quantity: 1 }],
    }).expect(201)
    expect(fresh.body.total).toBe(99_000)
  })

  // ── Otorisasi ─────────────────────────────────────────────────────────────
  it('STAFF tidak boleh memberi diskon, OWNER boleh', async () => {
    const asStaff = await createOrder(staffToken, { ...baseOrder(), discount: 10_000 }).expect(403)
    expect(asStaff.body.code).toBe('FORBIDDEN_ROLE')
    expect(await prisma.order.count()).toBe(0)

    const asOwner = await createOrder(ownerToken, { ...baseOrder(), discount: 10_000 }).expect(201)
    expect(asOwner.body.discount).toBe(10_000)
    expect(asOwner.body.total).toBe(110_000)
  })

  it('diskon melebihi subtotal ditolak', async () => {
    const res = await createOrder(ownerToken, { ...baseOrder(), discount: 999_999 }).expect(422)
    expect(res.body.code).toBe('DISCOUNT_EXCEEDS_SUBTOTAL')
  })

  it('allowedTransitions disesuaikan dengan peran peminta', async () => {
    const created = await createOrder(staffToken, baseOrder()).expect(201)
    const id = created.body.id
    await request(app.getHttpServer())
      .patch(`${API}/orders/${id}/status`)
      .set(auth(staffToken))
      .send({ status: OrderStatus.IN_PROGRESS })
      .expect(200)

    const forStaff = await request(app.getHttpServer())
      .get(`${API}/orders/${id}`)
      .set(auth(staffToken))
      .expect(200)
    const forOwner = await request(app.getHttpServer())
      .get(`${API}/orders/${id}`)
      .set(auth(ownerToken))
      .expect(200)

    expect(forStaff.body.allowedTransitions).toEqual([OrderStatus.READY])
    expect(forOwner.body.allowedTransitions).toEqual([OrderStatus.READY, OrderStatus.CANCELLED])
  })

  // ── Pelanggan inline ──────────────────────────────────────────────────────
  it('nomor HP inline yang sudah terdaftar memakai pelanggan yang ada, bukan error', async () => {
    await createOrder(staffToken, baseOrder()).expect(201)
    await createOrder(staffToken, {
      customer: { name: 'Andi (ketik ulang)', phone: '081234567890' },
      items: [{ serviceId: washId, quantity: 1 }],
    }).expect(201)

    expect(await prisma.customer.count()).toBe(1)
  })

  // ── Pembayaran ────────────────────────────────────────────────────────────
  it('pembayaran melebihi sisa tagihan ditolak dan menyertakan sisa', async () => {
    const created = await createOrder(staffToken, baseOrder()).expect(201)
    const pay = (amount: number) =>
      request(app.getHttpServer())
        .patch(`${API}/orders/${created.body.id}/payment`)
        .set(auth(staffToken))
        .send({ amount, method: 'CASH' })

    const partial = await pay(60_000).expect(200)
    expect(partial.body.paymentStatus).toBe(PaymentStatus.PARTIAL)

    const tooMuch = await pay(999_999).expect(422)
    expect(tooMuch.body.code).toBe('PAYMENT_EXCEEDS_TOTAL')
    expect(tooMuch.body.details.remainingAmount).toBe(60_000)

    const settled = await pay(60_000).expect(200)
    expect(settled.body.paymentStatus).toBe(PaymentStatus.PAID)
  })
})
