# 06 — Backend Structure

Struktur internal API NestJS: bagaimana kode disusun, di mana aturan bisnis hidup, dan aturan yang menjaga agar aturan itu tidak tercecer seiring waktu.

## Struktur folder

```
apps/api/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── main.ts                       # bootstrap, pipe global, Swagger
│   ├── app.module.ts
│   ├── config/
│   │   ├── env.schema.ts             # validasi env dengan Zod
│   │   └── config.module.ts
│   ├── prisma/
│   │   ├── prisma.module.ts          # @Global
│   │   └── prisma.service.ts
│   ├── common/
│   │   ├── filters/
│   │   │   └── all-exceptions.filter.ts
│   │   ├── exceptions/
│   │   │   └── app.exception.ts      # error domain + `code`
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts     # global
│   │   │   └── roles.guard.ts
│   │   ├── decorators/
│   │   │   ├── public.decorator.ts
│   │   │   ├── roles.decorator.ts
│   │   │   └── current-user.decorator.ts
│   │   ├── pipes/
│   │   │   └── zod-validation.pipe.ts
│   │   ├── interceptors/
│   │   │   └── logging.interceptor.ts
│   │   └── utils/
│   │       ├── phone.ts              # normalisasi nomor HP
│   │       └── date.ts               # batas hari Asia/Jakarta
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── customers/
│   │   ├── services/
│   │   ├── orders/
│   │   ├── reports/
│   │   └── health/
│   └── main.ts
└── test/
    └── e2e/
```

## Anatomi satu modul

Contoh `orders/`:

```
orders/
├── orders.module.ts
├── orders.controller.ts        # HTTP: route, validasi, otorisasi
├── orders.service.ts           # aturan bisnis, transaksi
├── order-number.service.ts     # penerbitan orderNumber
├── order-status.rules.ts       # tabel transisi + assertTransitionAllowed()
├── order-pricing.ts            # fungsi murni perhitungan
├── orders.mapper.ts            # entity Prisma → bentuk response
└── dto/
    ├── create-order.dto.ts
    ├── update-order-status.dto.ts
    ├── record-payment.dto.ts
    └── query-orders.dto.ts
```

Tanggung jawab tiap lapis:

| Berkas | Tanggung jawab | Yang **tidak** boleh dilakukan |
|---|---|---|
| `*.controller.ts` | Terima request, validasi DTO, cek peran, panggil service, kembalikan hasil mapper | Menyentuh `PrismaService`, memuat aturan bisnis |
| `*.service.ts` | Aturan bisnis, orkestrasi transaksi, akses database | Membaca objek `Request`, menyusun response HTTP |
| `*.rules.ts`, `*-pricing.ts` | Fungsi murni tanpa I/O | Menyentuh database atau injeksi apa pun |
| `*.mapper.ts` | Bentuk entity → bentuk response, buang field sensitif | Melakukan query |
| `dto/` | Skema Zod dari `packages/shared` + dekorator Swagger | Memuat logika |

**Aturan yang tidak bisa ditawar: controller tidak pernah menyentuh Prisma.** Begitu satu controller melakukan query "kecil saja", tidak lama kemudian ada aturan bisnis yang hidup di dua tempat dan hanya salah satunya diuji.

## Transaksi pembuatan pesanan

Satu-satunya jalur pembuatan pesanan, seluruhnya dalam satu `prisma.$transaction`:

```ts
async create(dto: CreateOrderDto, currentUser: AuthUser): Promise<OrderResponse> {
  if (dto.items.length === 0) throw new AppException('ORDER_EMPTY_ITEMS')
  if (dto.discount > 0 && currentUser.role !== Role.OWNER) {
    throw new AppException('FORBIDDEN_ROLE')
  }

  return this.prisma.$transaction(async (tx) => {
    // 1. Pelanggan: pakai yang ada, atau buat baru dari data inline
    const customer = await this.resolveCustomer(tx, dto)

    // 2. Ambil layanan — harga SELALU dari database, tidak pernah dari client
    const services = await tx.service.findMany({
      where: { id: { in: dto.items.map((i) => i.serviceId) } },
    })
    assertAllServicesFound(services, dto.items)
    assertAllServicesActive(services)          // -> SERVICE_INACTIVE

    // 3. Hitung (fungsi murni, teruji terpisah)
    const items = buildOrderItems(dto.items, services)
    const totals = calculateOrderTotals(items, dto.discount)   // -> DISCOUNT_EXCEEDS_SUBTOTAL
    const estimatedDoneAt = calculateEstimatedDoneAt(services, new Date())

    // 4. Nomor pesanan: increment atomik, tidak akan bentrok
    const orderNumber = await this.orderNumberService.next(tx)

    // 5. Simpan Order + item + entri riwayat pertama
    const order = await tx.order.create({
      data: {
        orderNumber,
        customerId: customer.id,
        createdById: currentUser.id,
        status: OrderStatus.RECEIVED,
        subtotal: totals.subtotal,
        discount: totals.discount,
        total: totals.total,
        estimatedDoneAt,
        notes: dto.notes,
        items: { create: items },
        statusHistory: {
          create: { fromStatus: null, toStatus: OrderStatus.RECEIVED, changedById: currentUser.id },
        },
      },
      include: ORDER_FULL_INCLUDE,
    })

    return toOrderResponse(order)
  })
}
```

Yang dijamin transaksi ini:

- Tidak ada `Order` tanpa `OrderItem`.
- Tidak ada pesanan tanpa entri riwayat status pertama.
- Nomor pesanan yang sudah diterbitkan tidak terbuang kalau langkah berikutnya gagal — rollback mengembalikan counter.
- Harga yang tersimpan adalah harga di database **pada saat transaksi**, bukan yang dikirim client.

### Penerbitan `orderNumber`

```ts
// order-number.service.ts
async next(tx: Prisma.TransactionClient): Promise<string> {
  const dateKey = jakartaDateKey(new Date())     // "20260822"
  const [row] = await tx.$queryRaw<{ last_number: number }[]>`
    INSERT INTO order_sequences (date, last_number) VALUES (${dateKey}, 1)
    ON CONFLICT (date) DO UPDATE SET last_number = order_sequences.last_number + 1
    RETURNING last_number
  `
  return `LDY-${dateKey}-${String(row.last_number).padStart(3, '0')}`
}
```

`COUNT(*) + 1` **tidak dipakai** — dua request bersamaan akan membaca hitungan yang sama dan menghasilkan nomor kembar. `INSERT … ON CONFLICT DO UPDATE` mengunci baris tanggal dan menyerialkan keduanya.

## Penegakan state machine

Seluruh aturan transisi ada di **satu berkas**, dan tidak ada jalur perubahan status yang melewatinya.

```ts
// order-status.rules.ts
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  RECEIVED:    [OrderStatus.IN_PROGRESS, OrderStatus.CANCELLED],
  IN_PROGRESS: [OrderStatus.READY, OrderStatus.CANCELLED],
  READY:       [OrderStatus.COMPLETED],
  COMPLETED:   [],
  CANCELLED:   [],
}

// Transisi yang menuntut peran tertentu
const ROLE_RESTRICTED: Array<{ from: OrderStatus; to: OrderStatus; role: Role }> = [
  { from: OrderStatus.IN_PROGRESS, to: OrderStatus.CANCELLED, role: Role.OWNER },
]

export function allowedTransitions(current: OrderStatus, role: Role): OrderStatus[] {
  return TRANSITIONS[current].filter(
    (to) => !ROLE_RESTRICTED.some((r) => r.from === current && r.to === to && r.role !== role),
  )
}

export function assertTransitionAllowed(
  order: Pick<Order, 'status' | 'paymentStatus'>,
  to: OrderStatus,
  role: Role,
): void {
  if (TRANSITIONS[order.status].length === 0) {
    throw new AppException('ORDER_ALREADY_FINAL', { currentStatus: order.status })
  }
  if (!allowedTransitions(order.status, role).includes(to)) {
    throw new AppException('ORDER_INVALID_TRANSITION', {
      currentStatus: order.status,
      requestedStatus: to,
    })
  }
  if (to === OrderStatus.COMPLETED && order.paymentStatus !== PaymentStatus.PAID) {
    throw new AppException('ORDER_NOT_FULLY_PAID')
  }
}
```

`allowedTransitions()` melayani dua kebutuhan sekaligus: memvalidasi request masuk, **dan** mengisi field `allowedTransitions` pada response `GET /orders/:id` yang dipakai mobile untuk merender tombol ([05](05-mobile-app.md#detail-pesanan)). Karena keduanya membaca tabel yang sama, UI dan penegakan server tidak mungkin berbeda.

Perubahan status juga dibungkus transaksi — ubah `Order` dan tulis `OrderStatusHistory` tidak boleh terpisah:

```ts
async updateStatus(id: string, dto: UpdateOrderStatusDto, currentUser: AuthUser) {
  return this.prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id } })
    assertTransitionAllowed(order, dto.status, currentUser.role)
    if (dto.status === OrderStatus.CANCELLED && !dto.note) {
      throw new AppException('VALIDATION_FAILED', { fields: { note: 'Alasan pembatalan wajib diisi' } })
    }

    const updated = await tx.order.update({
      where: { id },
      data: {
        status: dto.status,
        completedAt: dto.status === OrderStatus.COMPLETED ? new Date() : undefined,
        cancelledAt: dto.status === OrderStatus.CANCELLED ? new Date() : undefined,
        cancelReason: dto.status === OrderStatus.CANCELLED ? dto.note : undefined,
        statusHistory: {
          create: {
            fromStatus: order.status,
            toStatus: dto.status,
            changedById: currentUser.id,
            note: dto.note,
          },
        },
      },
      include: ORDER_FULL_INCLUDE,
    })

    return toOrderResponse(updated, currentUser.role)
  })
}
```

## Pembayaran

`paymentStatus` adalah **nilai turunan**, dihitung oleh satu fungsi murni yang dipakai di mana pun pembayaran berubah:

```ts
// order-pricing.ts
export function derivePaymentStatus(paidAmount: number, total: number): PaymentStatus {
  if (paidAmount <= 0) return PaymentStatus.UNPAID
  if (paidAmount >= total) return PaymentStatus.PAID
  return PaymentStatus.PARTIAL
}
```

Tidak ada tempat lain yang boleh menetapkan `paymentStatus` secara langsung. Client juga tidak pernah mengirimnya — yang dikirim hanyalah nominal yang dibayarkan sekarang.

## Autentikasi & otorisasi

- **Guard global** `JwtAuthGuard` terpasang di level aplikasi; endpoint publik ditandai `@Public()`. Defaultnya aman: lupa memasang guard tidak akan membuat endpoint terbuka.
- `RolesGuard` membaca `@Roles(Role.OWNER)` pada handler.
- `@CurrentUser()` menyuntikkan pengguna terautentikasi ke parameter, sehingga service tidak perlu tahu tentang objek `Request`.
- Password di-hash dengan **argon2id**.
- Refresh token dirotasi setiap kali dipakai; token lama ditolak.

```ts
@Controller('orders')
export class OrdersController {
  @Post()
  create(@Body() dto: CreateOrderDto, @CurrentUser() user: AuthUser) {
    return this.ordersService.create(dto, user)
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.ordersService.findOne(id, user)
  }
}

@Controller('reports')
@Roles(Role.OWNER)
export class ReportsController { /* ... */ }
```

Pembatasan peran yang bergantung isi payload — `STAFF` tidak boleh mengirim `discount > 0` — tidak bisa diwakili dekorator dan karenanya diperiksa di service, bersama aturan bisnis lainnya.

## Penanganan error

Error domain dilempar sebagai `AppException` yang membawa `code`; filter global menerjemahkannya ke bentuk response tunggal di [04](04-api-contract.md#format-error).

```ts
// common/exceptions/app.exception.ts
export const ERROR_CATALOG = {
  ORDER_INVALID_TRANSITION: { status: 422, message: 'Perubahan status pesanan tidak diizinkan.' },
  ORDER_NOT_FULLY_PAID:     { status: 422, message: 'Pesanan belum lunas dan tidak bisa diselesaikan.' },
  SERVICE_INACTIVE:         { status: 422, message: 'Ada layanan yang sudah tidak aktif dalam pesanan ini.' },
  CUSTOMER_PHONE_TAKEN:     { status: 409, message: 'Nomor HP sudah terdaftar atas pelanggan lain.' },
  // ...
} as const

export class AppException extends Error {
  constructor(
    public readonly code: keyof typeof ERROR_CATALOG,
    public readonly details?: Record<string, unknown>,
  ) {
    super(ERROR_CATALOG[code].message)
  }
}
```

Katalog terpusat berarti pesan Bahasa Indonesia untuk staff hidup di satu tempat, dan tidak ada `code` yang dipakai tanpa pesan pendampingnya.

`AllExceptionsFilter` juga menangkap error Prisma yang bocor (mis. `P2002` unique violation) dan memetakannya ke kode domain yang sesuai, sehingga client tidak pernah menerima detail internal database.

## Konfigurasi

Env divalidasi saat boot; aplikasi **menolak start** kalau ada yang kurang, alih-alih gagal saat request pertama masuk.

```ts
// config/env.schema.ts
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  SEED_OWNER_EMAIL: z.string().email().optional(),
  SEED_OWNER_PASSWORD: z.string().min(8).optional(),
  APP_TIMEZONE: z.string().default('Asia/Jakarta'),
})
```

Tidak ada nilai default untuk secret. Secret yang punya fallback pada akhirnya akan terbawa ke produksi.

## Logging

- Pino, JSON terstruktur, dengan `requestId` per request.
- Field yang selalu di-redact: `password`, `passwordHash`, `accessToken`, `refreshToken`, `authorization`.
- Level `error` hanya untuk kesalahan tak terduga. `AppException` (kesalahan operasional yang diharapkan, mis. transisi tidak valid) dicatat sebagai `warn` — supaya alerting produksi tidak tenggelam oleh staff yang salah tekan tombol.

## Strategi testing

| Jenis | Cakupan | Alat |
|---|---|---|
| Unit | Fungsi murni: `calculateOrderTotals`, `derivePaymentStatus`, `assertTransitionAllowed`, `allowedTransitions`, normalisasi nomor HP, batas hari Jakarta | Jest, tanpa database |
| Integrasi | Service dengan database sungguhan: transaksi pembuatan pesanan, keunikan nomor pesanan di bawah concurrency | Jest + Postgres di Docker |
| E2E | Alur HTTP penuh: login → buat pesanan → ubah status → catat bayar → selesai | Supertest |

Kasus yang **wajib** punya test, karena masing-masing adalah invariant di [03](03-data-model.md#invariant):

1. `total = subtotal − discount` dengan dan tanpa diskon.
2. `subtotal item = unitPrice × quantity`.
3. `derivePaymentStatus` di tiga batas: 0, kurang dari total, sama dengan total.
4. Setiap transisi valid diterima; setiap transisi tidak valid ditolak dengan `ORDER_INVALID_TRANSITION`.
5. `READY → COMPLETED` ditolak saat belum lunas.
6. Membatalkan dari `IN_PROGRESS` ditolak untuk `STAFF`, diterima untuk `OWNER`.
7. Pesanan dengan `serviceId` nonaktif ditolak seluruhnya — **tidak ada** `Order` parsial yang tersimpan.
8. 20 pembuatan pesanan bersamaan menghasilkan 20 `orderNumber` yang berbeda.
9. Mengubah harga `Service` tidak mengubah `total` pesanan yang sudah ada.
10. `passwordHash` tidak muncul di response endpoint mana pun.

Nomor 7, 8, dan 9 adalah yang paling sering lolos dari pengujian manual dan paling mahal saat terjadi di produksi.

## Docker Compose

Rencana `docker-compose.yml` di root repositori:

```yaml
services:
  postgres:
    image: postgres:18-alpine
    environment:
      POSTGRES_USER: laundry
      POSTGRES_PASSWORD: laundry
      POSTGRES_DB: laundry
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U laundry']
      interval: 5s
      retries: 5

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    environment:
      DATABASE_URL: postgresql://laundry:laundry@postgres:5432/laundry
      JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
    ports:
      - '3000:3000'
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  postgres_data:
```

Migrasi dijalankan sebagai langkah terpisah (`npx prisma migrate deploy`), bukan di dalam perintah start container. Menggabungkannya berarti setiap replika mencoba bermigrasi bersamaan saat scale-out.

## Perintah pengembangan

```bash
docker compose up -d postgres          # database saja
npm run -w api prisma:migrate          # terapkan migrasi
npm run -w api prisma:seed             # isi layanan + akun owner
npm run -w api start:dev               # API di :3000, Swagger di /api/docs
npm run -w api test                    # unit + integrasi
npm run -w api test:e2e                # e2e
```

---

Sebelumnya: [05 — Mobile App](05-mobile-app.md) · Lanjut ke [07 — Roadmap](07-roadmap.md).
