# 00 — Overview

## Masalah

Usaha laundry & perawatan sepatu skala kecil biasanya mencatat pesanan secara manual: buku tulis, nota rangkap, atau chat WhatsApp. Konsekuensinya berulang dan mahal:

- **Status pengerjaan tidak terlacak.** Pelanggan bertanya "sepatu saya sudah selesai?" dan staff harus mencari fisik sepatunya.
- **Harga tidak konsisten.** Tarif repaint berbeda antar staff karena hanya diingat, bukan dicatat.
- **Rekap harian memakan waktu.** Menjumlahkan nota di akhir hari, rawan salah hitung.
- **Riwayat pelanggan hilang.** Tidak tahu siapa pelanggan berulang, tidak bisa follow-up.

## Solusi

Satu aplikasi mobile internal yang dipakai staff di outlet, dengan backend terpusat sebagai sumber kebenaran data. Alur intinya sederhana dan harus bisa selesai dalam waktu kurang dari satu menit per pesanan.

## Aktor

Aplikasi ini **internal**. Pelanggan tidak punya akun dan tidak memasang aplikasi apa pun — datanya dicatat oleh staff.

| Aktor | Kode | Kemampuan |
|---|---|---|
| Pemilik | `OWNER` | Semua yang bisa dilakukan `STAFF`, ditambah: kelola master layanan & harga, kelola akun staff, lihat laporan, beri diskon |
| Staff | `STAFF` | Buat pesanan, ubah status pesanan, catat pembayaran, kelola data pelanggan |
| Pelanggan | — | Bukan pengguna sistem. Menjadi **data** (`Customer`), bukan aktor |

## User story inti

> Sebagai **staff**, saya ingin mencatat pesanan yang baru masuk dengan cepat, supaya pelanggan tidak menunggu dan saya tidak lupa detailnya.

Alurnya:

1. Staff membuka aplikasi (sudah login, sesi bertahan).
2. Tekan **Buat Pesanan**.
3. Cari pelanggan lewat nomor HP — kalau belum ada, buat baru saat itu juga (nama + nomor HP saja).
4. Tambahkan item: pilih **tipe jasa** (Cuci Sepatu / Repaint / Reglue) dan isi **jumlah**. Bisa lebih dari satu item dalam satu pesanan.
5. Sistem menghitung subtotal per item dan total pesanan secara otomatis dari harga master.
6. Simpan. Sistem menerbitkan nomor pesanan (mis. `LDY-20260822-007`) dan estimasi selesai.
7. Selanjutnya staff mengubah status pesanan seiring pengerjaan sampai sepatu diambil pelanggan.

Story pendukung:

> Sebagai **staff**, saya ingin melihat daftar pesanan yang **siap diambil**, supaya saya bisa menyerahkan sepatu tanpa mencari-cari.

> Sebagai **owner**, saya ingin melihat rekap hari ini (jumlah pesanan masuk, sedang dikerjakan, siap diambil, dan omzet), supaya saya tahu kondisi usaha tanpa membuka buku.

> Sebagai **owner**, saya ingin mengubah harga layanan, dan perubahan itu **tidak boleh** mengubah total pesanan yang sudah terlanjur dibuat.

## Ruang lingkup MVP

Yang **masuk** MVP:

- Autentikasi staff & owner (email/nomor HP + password), dengan peran `OWNER` / `STAFF`.
- Master **layanan** (`Service`): nama, kategori, satuan, harga, estimasi hari pengerjaan, aktif/nonaktif.
- Data **pelanggan** (`Customer`): nama, nomor HP, catatan. Pencarian cepat by nomor HP.
- **Pesanan** (`Order`) dengan banyak item, tiap item merujuk satu layanan + jumlah.
- Perhitungan subtotal, diskon, dan total **di server**.
- **Status pesanan** dengan alur terkontrol + riwayat perubahan (siapa mengubah, kapan).
- Status pembayaran sederhana: belum bayar / DP sebagian / lunas, dicatat manual (tunai/transfer).
- **Rekap harian**: jumlah pesanan per status dan total omzet.

## Non-goals (eksplisit di luar MVP)

Ditulis eksplisit supaya tidak diam-diam masuk saat implementasi. Semuanya ada di [roadmap](07-roadmap.md) sebagai fase lanjutan.

| Tidak dikerjakan sekarang | Alasan |
|---|---|
| Payment gateway (Midtrans/Xendit) | Transaksi di outlet mayoritas tunai/transfer manual. Integrasi menambah kompleksitas & biaya sebelum kebutuhan terbukti |
| Push notification ke pelanggan | Pelanggan tidak punya aplikasi. Fase berikutnya cukup lewat WhatsApp deep link |
| Aplikasi khusus pelanggan | Menggandakan lingkup auth, keamanan, dan UI sebelum alur internal terbukti jalan |
| Multi-outlet / multi-tenant | Satu outlet dulu. Skema dirancang supaya `outletId` bisa ditambahkan tanpa migrasi merusak |
| Manajemen inventory bahan | Bukan penghambat operasional harian saat ini |
| Foto sepatu sebelum/sesudah | Butuh object storage & penanganan upload. Bernilai tinggi, tapi bukan penghalang MVP |
| Offline-first & sinkronisasi | Outlet punya koneksi. MVP online-only dengan cache; antrean offline jauh lebih rumit dan bisa menyebabkan konflik data |
| Laporan keuangan lengkap / akuntansi | Rekap harian sudah menjawab kebutuhan awal |

## Glosarium — istilah UI vs istilah kode

**Aturan bahasa proyek ini:** yang dilihat pengguna berbahasa Indonesia; yang ada di dalam kode berbahasa Inggris. Tidak ada nama tabel, field, enum, atau route berbahasa Indonesia. Tidak ada label UI berbahasa Inggris.

Tabel ini adalah rujukan tunggal pemetaannya.

### Entitas

| UI (Indonesia) | Kode (Inggris) |
|---|---|
| Pesanan | `Order` |
| Item pesanan | `OrderItem` |
| Layanan / Jasa | `Service` |
| Pelanggan | `Customer` |
| Pengguna / Akun | `User` |
| Riwayat status | `OrderStatusHistory` |
| Nomor pesanan | `orderNumber` |
| Jumlah | `quantity` |
| Harga satuan | `unitPrice` |
| Subtotal | `subtotal` |
| Diskon | `discount` |
| Total | `total` |
| Catatan | `notes` |

### Status pesanan — `OrderStatus`

| UI (Indonesia) | Kode (Inggris) | Arti |
|---|---|---|
| Diterima | `RECEIVED` | Sepatu sudah diterima, belum dikerjakan |
| Dikerjakan | `IN_PROGRESS` | Sedang dalam proses |
| Siap Diambil | `READY` | Selesai dikerjakan, menunggu pelanggan |
| Selesai | `COMPLETED` | Sudah diambil pelanggan |
| Dibatalkan | `CANCELLED` | Dibatalkan sebelum selesai |

### Status pembayaran — `PaymentStatus`

| UI (Indonesia) | Kode (Inggris) |
|---|---|
| Belum Bayar | `UNPAID` |
| Bayar Sebagian | `PARTIAL` |
| Lunas | `PAID` |

### Kategori layanan — `ServiceCategory`

| UI (Indonesia) | Kode (Inggris) |
|---|---|
| Cuci Sepatu | `SHOE_LAUNDRY` |
| Repaint | `REPAINT` |
| Reglue | `REGLUE` |
| Lainnya | `OTHER` |

### Satuan — `ServiceUnit`

| UI (Indonesia) | Kode (Inggris) |
|---|---|
| Pasang | `PAIR` |
| Item | `ITEM` |
| Kilogram | `KG` |

### Peran — `Role`

| UI (Indonesia) | Kode (Inggris) |
|---|---|
| Pemilik | `OWNER` |
| Staff | `STAFF` |

---

Lanjut ke [01 — Arsitektur](01-architecture.md).
