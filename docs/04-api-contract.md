# 04 — API Contract

Kontrak antara aplikasi mobile dan backend. Nama field mengikuti [03 — Data Model](03-data-model.md) persis.

## Konvensi

| Aspek | Aturan |
|---|---|
| Base URL | `/api/v1` |
| Format | JSON, `Content-Type: application/json` |
| Penamaan field | `camelCase` |
| Autentikasi | Header `Authorization: Bearer <accessToken>` pada semua endpoint kecuali yang ditandai publik |
| Waktu | ISO-8601 dengan offset UTC, mis. `2026-08-22T09:15:00.000Z`. Konversi ke WIB dilakukan di client |
| Uang | Integer rupiah penuh. `35000` berarti Rp 35.000. Server tidak pernah mengirim string terformat |
| Enum | Dikirim sebagai string Inggris (`RECEIVED`). Client memetakan ke label Indonesia |
| ID | UUID v4 string |

## Format error

Satu bentuk untuk **semua** error di seluruh API:

```json
{
  "statusCode": 422,
  "code": "ORDER_INVALID_TRANSITION",
  "message": "Pesanan berstatus READY tidak bisa diubah menjadi IN_PROGRESS.",
  "details": {
    "currentStatus": "READY",
    "requestedStatus": "IN_PROGRESS"
  }
}
```

- `code` adalah kunci stabil untuk logika client — **jangan** mencocokkan `message`.
- `message` sudah berbahasa Indonesia dan layak ditampilkan langsung ke staff.
- `details` opsional, berisi konteks tambahan.

### Daftar kode error

| `code` | HTTP | Kapan muncul |
|---|---|---|
| `VALIDATION_FAILED` | 400 | Bentuk payload salah. `details.fields` berisi error per field |
| `INVALID_CREDENTIALS` | 401 | Email atau password salah |
| `TOKEN_EXPIRED` | 401 | Access token kedaluwarsa — client memicu refresh |
| `TOKEN_INVALID` | 401 | Token rusak atau refresh token tidak berlaku |
| `ACCOUNT_INACTIVE` | 403 | `User.isActive = false` |
| `FORBIDDEN_ROLE` | 403 | Peran tidak berwenang untuk aksi ini |
| `RESOURCE_NOT_FOUND` | 404 | ID tidak ditemukan |
| `CUSTOMER_PHONE_TAKEN` | 409 | Nomor HP sudah dipakai pelanggan lain |
| `SERVICE_CODE_TAKEN` | 409 | `Service.code` sudah dipakai |
| `SERVICE_INACTIVE` | 422 | Ada `serviceId` nonaktif dalam pesanan baru |
| `ORDER_EMPTY_ITEMS` | 422 | Pesanan dikirim tanpa item |
| `ORDER_INVALID_TRANSITION` | 422 | Transisi status tidak diizinkan |
| `ORDER_NOT_FULLY_PAID` | 422 | Mencoba `COMPLETED` sementara `paymentStatus ≠ PAID` |
| `ORDER_ALREADY_FINAL` | 422 | Pesanan sudah `COMPLETED` / `CANCELLED` |
| `PAYMENT_EXCEEDS_TOTAL` | 422 | `paidAmount` akan melebihi `total` |
| `DISCOUNT_EXCEEDS_SUBTOTAL` | 422 | `discount` lebih besar dari `subtotal` |
| `INTERNAL_ERROR` | 500 | Kesalahan tak terduga. `details` tidak pernah membocorkan internal |

## Otorisasi per endpoint

| Endpoint | `OWNER` | `STAFF` |
|---|---|---|
| `POST /auth/login`, `POST /auth/refresh` | publik | publik |
| `GET /auth/me` | ✅ | ✅ |
| `GET /services` | ✅ | ✅ |
| `POST /services`, `PATCH /services/:id` | ✅ | ❌ |
| `GET /customers`, `GET /customers/:id` | ✅ | ✅ |
| `POST /customers`, `PATCH /customers/:id` | ✅ | ✅ |
| `GET /orders`, `GET /orders/:id` | ✅ | ✅ |
| `POST /orders` | ✅ | ✅ |
| `POST /orders` dengan `discount > 0` | ✅ | ❌ |
| `PATCH /orders/:id/status` → `IN_PROGRESS`, `READY`, `COMPLETED` | ✅ | ✅ |
| `PATCH /orders/:id/status` → `CANCELLED` dari `RECEIVED` | ✅ | ✅ |
| `PATCH /orders/:id/status` → `CANCELLED` dari `IN_PROGRESS` | ✅ | ❌ |
| `PATCH /orders/:id/payment` | ✅ | ✅ |
| `GET /reports/daily-summary` | ✅ | ❌ |
| `GET /users`, `POST /users`, `PATCH /users/:id` | ✅ | ❌ |

---

## Auth

### `POST /auth/login` — publik

```json
{ "email": "budi@laundry.id", "password": "rahasia123" }
```

**200**

```json
{
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "eyJhbGciOi...",
  "expiresIn": 900,
  "user": {
    "id": "8f14e45f-ceea-4b1f-a1d9-1c8e4e3d2b7a",
    "name": "Budi Santoso",
    "email": "budi@laundry.id",
    "role": "STAFF"
  }
}
```

Error: `INVALID_CREDENTIALS` (401), `ACCOUNT_INACTIVE` (403).

Email yang tidak terdaftar dan password yang salah menghasilkan respons yang **sama persis** — tidak membocorkan email mana yang terdaftar.

### `POST /auth/refresh` — publik

```json
{ "refreshToken": "eyJhbGciOi..." }
```

**200** — bentuk sama dengan login. Refresh token lama tidak berlaku lagi setelah dipakai (rotasi).

### `GET /auth/me`

**200**

```json
{
  "id": "8f14e45f-ceea-4b1f-a1d9-1c8e4e3d2b7a",
  "name": "Budi Santoso",
  "email": "budi@laundry.id",
  "phone": "+6281234567890",
  "role": "STAFF",
  "isActive": true
}
```

---

## Services

### `GET /services`

Query: `category` (opsional), `isActive` (opsional, default `true`), `search` (opsional).

**200**

```json
{
  "data": [
    {
      "id": "1a2b3c4d-0000-4000-8000-000000000001",
      "code": "SHOE_WASH_REGULAR",
      "name": "Cuci Sepatu Reguler",
      "category": "SHOE_LAUNDRY",
      "unit": "PAIR",
      "price": 35000,
      "estimatedDays": 3,
      "description": "Cuci menyeluruh bagian luar dan sol",
      "isActive": true
    }
  ]
}
```

Tidak dipaginasi — jumlah layanan selalu kecil dan client menyimpannya dalam cache jangka panjang.

### `POST /services` — `OWNER`

```json
{
  "code": "REPAINT_FULL",
  "name": "Repaint Full",
  "category": "REPAINT",
  "unit": "PAIR",
  "price": 150000,
  "estimatedDays": 7,
  "description": "Pengecatan ulang seluruh permukaan"
}
```

**201** — objek `Service`. Error: `SERVICE_CODE_TAKEN` (409).

### `PATCH /services/:id` — `OWNER`

Partial update. Field yang boleh diubah: `name`, `category`, `unit`, `price`, `estimatedDays`, `description`, `isActive`. **`code` tidak bisa diubah.**

Mengubah `price` **tidak** memengaruhi pesanan yang sudah ada — lihat [snapshot harga](03-data-model.md#snapshot-nama--harga-di-orderitem).

---

## Customers

### `GET /customers`

Query: `search` (cocok pada nama **atau** nomor HP), `page` (default 1), `limit` (default 20, maks 100).

**200**

```json
{
  "data": [
    {
      "id": "c1000000-0000-4000-8000-000000000001",
      "name": "Andi Wijaya",
      "phone": "+6281234567890",
      "notes": "Sepatu putih, jangan disikat keras",
      "orderCount": 4,
      "lastOrderAt": "2026-08-19T04:20:00.000Z",
      "createdAt": "2026-05-01T02:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 137, "totalPages": 7 }
}
```

`orderCount` dan `lastOrderAt` hanya muncul di daftar dan detail pelanggan — membantu staff mengenali pelanggan berulang.

### `POST /customers`

```json
{ "name": "Andi Wijaya", "phone": "0812-3456-7890", "notes": null }
```

Server **menormalkan** nomor HP sebelum menyimpan: `0812-3456-7890` → `+6281234567890`. Client boleh mengirim format apa pun yang diketik staff.

**201** — objek `Customer`. Error: `CUSTOMER_PHONE_TAKEN` (409), dengan `details.customerId` berisi ID pelanggan yang sudah ada supaya client bisa langsung menawarkan "pakai pelanggan ini".

### `GET /customers/:id`

**200** — objek `Customer` + `recentOrders` (5 pesanan terakhir, bentuk ringkas).

### `PATCH /customers/:id`

Field yang boleh diubah: `name`, `phone`, `notes`.

---

## Orders

### `POST /orders`

Payload sengaja **tidak memuat harga apa pun**. Client mengirim niat; server menentukan angka.

```json
{
  "customerId": "c1000000-0000-4000-8000-000000000001",
  "items": [
    {
      "serviceId": "1a2b3c4d-0000-4000-8000-000000000001",
      "quantity": 2,
      "notes": "Nike AF1 putih, noda di ujung"
    },
    {
      "serviceId": "1a2b3c4d-0000-4000-8000-000000000006",
      "quantity": 1,
      "notes": null
    }
  ],
  "discount": 0,
  "notes": "Diambil hari Sabtu"
}
```

Alternatif untuk pelanggan baru — kirim `customer` inline alih-alih `customerId`, supaya staff tidak perlu dua request:

```json
{
  "customer": { "name": "Rina Kartika", "phone": "081298765432" },
  "items": [{ "serviceId": "1a2b3c4d-0000-4000-8000-000000000001", "quantity": 1 }]
}
```

Tepat salah satu dari `customerId` atau `customer` harus ada. Kalau nomor HP pada `customer` inline sudah terdaftar, server **memakai pelanggan yang ada** dan tidak mengembalikan error — ini alur yang paling sering terjadi di meja outlet.

**201**

```json
{
  "id": "o1000000-0000-4000-8000-000000000042",
  "orderNumber": "LDY-20260822-007",
  "status": "RECEIVED",
  "paymentStatus": "UNPAID",
  "paymentMethod": null,
  "customer": {
    "id": "c1000000-0000-4000-8000-000000000001",
    "name": "Andi Wijaya",
    "phone": "+6281234567890"
  },
  "items": [
    {
      "id": "i1000000-0000-4000-8000-000000000101",
      "serviceId": "1a2b3c4d-0000-4000-8000-000000000001",
      "serviceName": "Cuci Sepatu Reguler",
      "serviceUnit": "PAIR",
      "unitPrice": 35000,
      "quantity": 2,
      "subtotal": 70000,
      "notes": "Nike AF1 putih, noda di ujung"
    },
    {
      "id": "i1000000-0000-4000-8000-000000000102",
      "serviceId": "1a2b3c4d-0000-4000-8000-000000000006",
      "serviceName": "Reglue Sol",
      "serviceUnit": "PAIR",
      "unitPrice": 50000,
      "quantity": 1,
      "subtotal": 50000,
      "notes": null
    }
  ],
  "subtotal": 120000,
  "discount": 0,
  "total": 120000,
  "paidAmount": 0,
  "notes": "Diambil hari Sabtu",
  "receivedAt": "2026-08-22T02:10:00.000Z",
  "estimatedDoneAt": "2026-08-25T02:10:00.000Z",
  "completedAt": null,
  "createdBy": { "id": "8f14e45f-ceea-4b1f-a1d9-1c8e4e3d2b7a", "name": "Budi Santoso" },
  "createdAt": "2026-08-22T02:10:00.000Z"
}
```

Error: `ORDER_EMPTY_ITEMS`, `SERVICE_INACTIVE` (dengan `details.serviceIds`), `DISCOUNT_EXCEEDS_SUBTOTAL`, `FORBIDDEN_ROLE` (bila `STAFF` mengirim `discount > 0`), `RESOURCE_NOT_FOUND`.

### `GET /orders`

Query:

| Param | Nilai | Default |
|---|---|---|
| `status` | satu nilai `OrderStatus`, atau dipisah koma (`RECEIVED,IN_PROGRESS`) | semua |
| `search` | cocok pada `orderNumber`, nama pelanggan, atau nomor HP | — |
| `from` / `to` | tanggal `YYYY-MM-DD`, difilter pada `receivedAt` (batas hari WIB) | — |
| `customerId` | UUID | — |
| `page` | integer ≥ 1 | 1 |
| `limit` | 1–100 | 20 |
| `sort` | `receivedAt:desc`, `receivedAt:asc`, `estimatedDoneAt:asc` | `receivedAt:desc` |

**200** — bentuk ringkas (tanpa `items`, agar daftar tetap ringan):

```json
{
  "data": [
    {
      "id": "o1000000-0000-4000-8000-000000000042",
      "orderNumber": "LDY-20260822-007",
      "status": "RECEIVED",
      "paymentStatus": "UNPAID",
      "customer": { "id": "c1000000-0000-4000-8000-000000000001", "name": "Andi Wijaya", "phone": "+6281234567890" },
      "itemCount": 2,
      "totalQuantity": 3,
      "total": 120000,
      "receivedAt": "2026-08-22T02:10:00.000Z",
      "estimatedDoneAt": "2026-08-25T02:10:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 58, "totalPages": 3 }
}
```

**Kenapa offset pagination, bukan cursor:** daftar difilter per status dan hampir selalu pendek, dan staff butuh tahu jumlah total ("58 pesanan bulan ini"). Cursor pagination unggul pada feed panjang yang berubah cepat — bukan kasus di sini.

### `GET /orders/:id`

**200** — bentuk lengkap seperti response `POST /orders`, ditambah `statusHistory`:

```json
{
  "statusHistory": [
    {
      "id": "h1000000-0000-4000-8000-000000000201",
      "fromStatus": null,
      "toStatus": "RECEIVED",
      "note": null,
      "changedBy": { "id": "8f14e45f-ceea-4b1f-a1d9-1c8e4e3d2b7a", "name": "Budi Santoso" },
      "createdAt": "2026-08-22T02:10:00.000Z"
    },
    {
      "id": "h1000000-0000-4000-8000-000000000202",
      "fromStatus": "RECEIVED",
      "toStatus": "IN_PROGRESS",
      "note": null,
      "changedBy": { "id": "8f14e45f-ceea-4b1f-a1d9-1c8e4e3d2b7a", "name": "Budi Santoso" },
      "createdAt": "2026-08-22T06:30:00.000Z"
    }
  ],
  "allowedTransitions": ["READY", "CANCELLED"]
}
```

`allowedTransitions` dihitung server berdasarkan status saat ini **dan peran pengguna yang meminta**. Client memakainya untuk menentukan tombol mana yang ditampilkan, sehingga aturan transisi tidak perlu diduplikasi di mobile — cukup satu sumber di server.

### `PATCH /orders/:id/status`

```json
{ "status": "READY", "note": null }
```

Untuk pembatalan, `note` menjadi wajib dan disimpan sebagai `cancelReason`:

```json
{ "status": "CANCELLED", "note": "Pelanggan membatalkan, sepatu diambil kembali" }
```

**200** — objek `Order` lengkap dengan `statusHistory` dan `allowedTransitions` terbaru.

Error: `ORDER_INVALID_TRANSITION`, `ORDER_NOT_FULLY_PAID`, `ORDER_ALREADY_FINAL`, `FORBIDDEN_ROLE`, `VALIDATION_FAILED` (pembatalan tanpa `note`).

### `PATCH /orders/:id/payment`

```json
{ "amount": 60000, "method": "CASH" }
```

`amount` adalah **jumlah yang dibayarkan sekarang**, bukan total kumulatif. Server menambahkannya ke `paidAmount` dan menurunkan `paymentStatus` dari hasilnya.

**200**

```json
{
  "id": "o1000000-0000-4000-8000-000000000042",
  "total": 120000,
  "paidAmount": 60000,
  "paymentStatus": "PARTIAL",
  "paymentMethod": "CASH"
}
```

Error: `PAYMENT_EXCEEDS_TOTAL` (dengan `details.remainingAmount`), `ORDER_ALREADY_FINAL` (pesanan `CANCELLED`).

---

## Laporan

### `GET /reports/daily-summary` — `OWNER`

Query: `date` (`YYYY-MM-DD`, default hari ini menurut Asia/Jakarta).

**200**

```json
{
  "date": "2026-08-22",
  "ordersByStatus": {
    "RECEIVED": 5,
    "IN_PROGRESS": 12,
    "READY": 7,
    "COMPLETED": 9,
    "CANCELLED": 1
  },
  "newOrders": 6,
  "completedOrders": 9,
  "revenue": {
    "billed": 780000,
    "collected": 640000,
    "outstanding": 140000
  },
  "topServices": [
    { "serviceId": "1a2b3c4d-0000-4000-8000-000000000001", "serviceName": "Cuci Sepatu Reguler", "quantity": 14, "revenue": 490000 }
  ]
}
```

Definisi yang perlu tegas supaya angkanya bisa dipercaya:

| Field | Arti |
|---|---|
| `ordersByStatus` | **Foto kondisi saat ini** — jumlah pesanan yang *sekarang* berstatus itu, tanpa memandang tanggal masuk. Menjawab "berapa yang menumpuk di rak" |
| `newOrders` | Pesanan dengan `receivedAt` pada tanggal tersebut |
| `completedOrders` | Pesanan dengan `completedAt` pada tanggal tersebut |
| `revenue.billed` | Σ `total` dari pesanan yang **masuk** hari itu (tidak termasuk `CANCELLED`) |
| `revenue.collected` | Σ pembayaran yang **diterima** hari itu |
| `revenue.outstanding` | Σ `total − paidAmount` dari semua pesanan aktif yang belum lunas, **lintas tanggal** |

**Batas hari mengikuti Asia/Jakarta**, bukan UTC. Tanggal `2026-08-22` berarti rentang `2026-08-21T17:00:00Z` sampai `2026-08-22T17:00:00Z`. Kalau ini dilewatkan, pesanan sore hari akan jatuh ke tanggal yang salah pada laporan.

Pada MVP, `revenue.collected` didekati dari `paidAmount` pesanan yang tersentuh hari itu. Angka yang benar-benar tepat butuh tabel `Payment` — dicatat sebagai keterbatasan yang diketahui, dan diperbaiki bersama fitur payment di [roadmap](07-roadmap.md).

---

## Users — `OWNER`

`GET /users`, `POST /users`, `PATCH /users/:id`.

`POST /users` menerima `{ name, email, phone?, password, role }`. `passwordHash` **tidak pernah** ada dalam response mana pun. `PATCH` bisa mengubah `name`, `phone`, `role`, `isActive`; penggantian password memakai endpoint terpisah.

Akun tidak bisa dihapus, hanya `isActive = false`, agar `Order.createdById` dan riwayat status tetap utuh.

---

## Health

`GET /health` → `{ "status": "ok" }` — proses hidup.
`GET /health/ready` → `{ "status": "ok", "database": "ok" }` — database terjangkau. Dipakai orkestrator sebelum mengarahkan trafik.

Keduanya publik dan tidak dipaginasi maupun diautentikasi.

---

## Versioning

Base URL memuat `v1`. Aturan perubahan:

**Boleh tanpa naik versi** (client lama tetap jalan):

- Menambah field opsional pada response
- Menambah field opsional pada request
- Menambah endpoint baru
- Menambah nilai enum baru — **dengan syarat** client menangani nilai tak dikenal dengan aman (lihat catatan di bawah)

**Wajib naik ke `v2`:**

- Menghapus atau me-rename field
- Mengubah tipe atau arti field
- Menambah field wajib pada request
- Mengubah aturan otorisasi menjadi lebih ketat

**Catatan enum:** client mobile harus memperlakukan nilai enum tak dikenal sebagai keadaan netral (tampilkan kode mentah, jangan crash), karena perangkat outlet tidak selalu langsung diperbarui setelah backend di-deploy. Ini juga alasan `allowedTransitions` dihitung di server.

Dokumentasi Swagger interaktif tersedia di `/api/docs` pada lingkungan non-produksi.

---

Sebelumnya: [03 — Data Model](03-data-model.md) · Lanjut ke [05 — Mobile App](05-mobile-app.md).
