# 02 — Tech Stack

Semua pilihan di bawah berbasis **TypeScript**, dari database sampai layar. Satu bahasa untuk seluruh tim, tipe kontrak API dibagi antara backend dan mobile, dan tidak ada biaya pindah konteks antar-bahasa.

## Ringkasan

| Layer | Pilihan | Versi target | Alasan singkat |
|---|---|---|---|
| Monorepo | npm workspaces | npm 11+ | Sudah terpasang, tanpa tool tambahan |
| Bahasa | TypeScript (strict) | 5.6+ | Kontrak tipe dibagi antara API dan mobile |
| Backend framework | NestJS | 11 | Struktur modular bawaan, DI, guard, validasi — cocok untuk aplikasi transaksional |
| ORM | Prisma | 6 | Skema deklaratif, migrasi versioned, tipe hasil query otomatis |
| Database | PostgreSQL | 18 | Transaksi ACID, enum native, sudah terpasang di mesin |
| Auth | Passport JWT + argon2 | — | Standar, stateless, argon2id adalah rekomendasi hashing saat ini |
| Validasi backend | Zod (via pipe) | 3.23+ | Skema yang sama dipakai ulang di mobile lewat `packages/shared` |
| Logging | Pino (`nestjs-pino`) | — | Log JSON terstruktur, overhead rendah |
| Dokumentasi API | Swagger (`@nestjs/swagger`) | — | Ter-generate dari dekorator, selalu sinkron dengan kode |
| Mobile framework | Expo (managed) | SDK 52+ | Build & distribusi tanpa Xcode/Android Studio lokal |
| Navigasi | expo-router | 4+ | Routing berbasis file, deep link gratis |
| Server state | TanStack Query | 5 | Cache, retry, invalidasi, optimistic update |
| Client state | Zustand | 5 | Ringan; hanya untuk draft pesanan & sesi |
| Form | react-hook-form + Zod | 7 / 3 | Validasi form memakai skema yang sama dengan API |
| UI kit | React Native Paper | 5 | Komponen Material siap pakai untuk aplikasi padat form |
| Penyimpanan token | expo-secure-store | — | Keychain (iOS) / Keystore (Android) |
| Testing backend | Jest + Supertest | — | Bawaan NestJS |
| Kontainer | Docker + Docker Compose | 28 | Sudah terpasang |

## Struktur monorepo

```
laundry/
├── apps/
│   ├── api/                  # NestJS
│   └── mobile/               # Expo
├── packages/
│   └── shared/               # enum, tipe DTO, skema Zod — dipakai kedua sisi
├── docs/
├── docker-compose.yml
└── package.json              # npm workspaces
```

**Kenapa monorepo:** kontrak API adalah tempat bug paling sering muncul di proyek mobile + backend. Field yang di-rename di server dan lupa diubah di client baru ketahuan saat runtime, di tangan pengguna.

`packages/shared` menutup celah itu. Isinya:

- Enum domain (`OrderStatus`, `PaymentStatus`, `ServiceCategory`, `ServiceUnit`, `Role`)
- Skema Zod untuk request body (`createOrderSchema`, `updateOrderStatusSchema`, …)
- Tipe response (`OrderResponse`, `ServiceResponse`, …)

Backend memakainya untuk validasi masuk. Mobile memakainya untuk validasi form dan tipe response. Kalau backend mengubah bentuk payload, **build mobile gagal saat kompilasi** — bukan saat pengguna menekan tombol Simpan.

**Kenapa npm workspaces, bukan pnpm/Turborepo:** npm sudah terpasang dan cukup. Proyek dua aplikasi tidak butuh orkestrasi build berlapis. Kalau nanti build terasa lambat, Turborepo bisa ditambahkan tanpa mengubah struktur.

## Backend — kenapa NestJS

Alternatif yang wajar adalah Fastify atau Hono: lebih ringan dan lebih cepat dimulai. Yang membuat NestJS lebih pas di sini:

- **Struktur adalah bawaan, bukan konvensi tim.** Pola modul → controller → service memaksa pemisahan lapisan sejak file pertama. Di framework minimalis, disiplin itu harus dijaga manual dan biasanya luntur seiring waktu.
- **Guard & dekorator untuk otorisasi.** `@Roles(Role.OWNER)` di atas satu handler lebih sulit disalahtulis daripada pengecekan `if (user.role !== 'OWNER')` yang tersebar.
- **Dependency injection** membuat service bisa diuji tanpa menyentuh HTTP maupun database.
- **Swagger otomatis** dari dekorator DTO — dokumentasi API tidak pernah basi.

Biayanya adalah boilerplate yang lebih banyak dan waktu boot sedikit lebih lama. Untuk aplikasi transaksional yang akan hidup bertahun-tahun, itu pertukaran yang menguntungkan.

## Backend — kenapa Prisma

- Skema deklaratif di satu file, jadi [03 — Data Model](03-data-model.md) bisa langsung menjadi kode.
- **Migrasi versioned** yang masuk git dan bisa di-review — bukan perubahan skema manual di produksi.
- Hasil query bertipe otomatis, termasuk relasi yang di-`include`.
- `prisma.$transaction()` yang lugas — penting karena pembuatan pesanan menyentuh tiga tabel sekaligus.

Batasannya: query analitik yang rumit lebih enak ditulis sebagai SQL mentah. Prisma menyediakan `$queryRaw` untuk itu, dan rekap harian kemungkinan akan memakainya.

## Mobile — kenapa Expo

- **Build tanpa toolchain native lokal.** EAS Build menghasilkan APK/IPA di cloud. Tidak ada Xcode/Android Studio yang harus disetel di setiap mesin.
- **Distribusi internal cepat.** Aplikasi karyawan tidak perlu masuk store; EAS internal distribution memasang langsung ke perangkat.
- **Over-the-air update** untuk perbaikan JavaScript, tanpa menunggu instal ulang di setiap perangkat outlet.
- Modul native yang dibutuhkan (secure store, kamera untuk fase foto sepatu, print/share) semuanya tersedia di ekosistem Expo.

Kalau nanti butuh modul native yang tidak didukung, jalur keluarnya sudah tersedia lewat development build tanpa meninggalkan Expo.

## Mobile — pembagian state

Pemisahan ini disengaja dan penting untuk dijaga:

| Jenis state | Alat | Contoh |
|---|---|---|
| Data dari server | **TanStack Query** | Daftar pesanan, detail pesanan, daftar layanan, rekap harian |
| State UI sementara | **Zustand** | Draft pesanan yang sedang disusun, sesi auth |
| State form | **react-hook-form** | Isian pada layar Buat Pesanan & Kelola Layanan |

**Data server tidak pernah disalin ke Zustand.** Menyimpan hasil API di global store adalah jalan tercepat menuju data basi dan bug "kenapa layar ini masih menampilkan status lama". TanStack Query sudah menangani cache, refetch, dan invalidasi setelah mutasi.

Zustand hanya menyimpan hal yang memang bukan milik server: item-item yang sedang dirakit staff sebelum ditekan Simpan, dan token sesi.

## Mobile — kenapa React Native Paper

Aplikasi ini padat form dan daftar: input teks, pemilih angka, chip status, daftar bergulir, snackbar konfirmasi. React Native Paper menyediakan semuanya dengan aksesibilitas dan sentuhan yang sudah benar.

Alternatifnya adalah NativeWind (Tailwind di React Native) yang lebih fleksibel secara visual, tetapi setiap komponen harus dibangun sendiri. Untuk aplikasi internal, kecepatan membangun mengalahkan keunikan tampilan.

Yang tetap dikustom: **palet warna status pesanan**, karena membedakan "Dikerjakan" dari "Siap Diambil" dalam sekali lihat adalah kebutuhan operasional nyata. Detailnya di [05 — Mobile App](05-mobile-app.md).

## Alternatif yang dipertimbangkan dan ditolak

### Supabase (Backend-as-a-Service)

Menawarkan PostgreSQL, Auth, Storage, dan Realtime siap pakai — jalur tercepat menuju MVP yang berfungsi.

**Ditolak karena** logika bisnis inti aplikasi ini hidup di server: perhitungan total dari harga master, penerbitan nomor pesanan berurutan, dan penegakan transisi status. Di Supabase, semua itu berakhir sebagai Row Level Security policy plus Edge Function — lebih sulit diuji, lebih sulit di-review, dan tersebar di beberapa tempat. Ditambah lock-in yang nyata kalau nanti perlu pindah.

**Kapan pilihan ini layak ditinjau ulang:** kalau ternyata prioritas berubah menjadi aplikasi pelanggan dengan kebutuhan realtime, di mana Supabase justru unggul.

### Fastify / Hono + Drizzle

Lebih ringan, lebih sedikit boilerplate, waktu boot lebih cepat.

**Ditolak karena** struktur menjadi tanggung jawab tim sepenuhnya. Pada aplikasi yang akan bertambah modul (multi-outlet, inventory, aplikasi pelanggan), kerangka yang dipaksakan framework lebih berharga daripada beberapa milidetik latensi.

### Flutter

Performa UI sangat baik dan satu basis kode untuk dua platform.

**Ditolak karena** SDK Flutter belum terpasang di mesin pengembangan, dan yang lebih penting: memilih Dart berarti kehilangan tipe kontrak yang dibagi dengan backend TypeScript. Manfaat `packages/shared` hilang seluruhnya.

### GraphQL alih-alih REST

**Ditolak karena** aplikasi ini punya satu klien dengan kebutuhan data yang sudah diketahui. Manfaat utama GraphQL — klien beragam yang meminta bentuk data berbeda-beda — tidak ada di sini, sementara biayanya (skema, resolver, penanganan N+1, caching yang lebih rumit) tetap harus dibayar.

---

Sebelumnya: [01 — Arsitektur](01-architecture.md) · Lanjut ke [03 — Data Model](03-data-model.md).
