# Laundry App — Dokumen Arsitektur

Aplikasi operasional untuk usaha **laundry & perawatan sepatu**. Staff atau owner mencatat pesanan langsung di outlet lewat aplikasi mobile: pilih pelanggan, pilih tipe jasa (cuci sepatu, repaint, reglue), masukkan jumlah, sistem menghitung total dan melacak status pengerjaan sampai sepatu diambil pelanggan.

> **Status: fondasi backend + scaffold mobile.** Backend MVP sudah memiliki modul inti dan test otomatis. Mobile sedang dibangun bertahap mengikuti roadmap.

## Keputusan utama

| Aspek | Keputusan |
|---|---|
| Pengguna aplikasi | Staff & owner (internal) — pelanggan **bukan** pengguna app |
| Mobile | React Native via **Expo** |
| Backend | **NestJS** + Prisma + PostgreSQL |
| Arsitektur | Modular monolith, satu deployable |
| Cakupan sekarang | MVP — payment gateway, notifikasi, multi-outlet menyusul |
| Bahasa | UI & dokumen **Bahasa Indonesia**; kode, tabel, field, enum **Bahasa Inggris** |

## Indeks dokumen

| # | Dokumen | Isi |
|---|---|---|
| 00 | [Overview](docs/00-overview.md) | Masalah, aktor, ruang lingkup MVP, non-goals, glosarium istilah |
| 01 | [Arsitektur](docs/01-architecture.md) | Komponen sistem, alur request, batas tanggung jawab, deployment |
| 02 | [Tech Stack](docs/02-tech-stack.md) | Pilihan framework, alasan, dan alternatif yang ditolak |
| 03 | [Data Model](docs/03-data-model.md) | ERD, tabel, enum, skema Prisma, state machine, aturan hitung |
| 04 | [API Contract](docs/04-api-contract.md) | Endpoint REST, payload, format error, otorisasi |
| 05 | [Mobile App](docs/05-mobile-app.md) | Peta layar, wireframe, state management, struktur folder |
| 06 | [Backend Structure](docs/06-backend-structure.md) | Modul NestJS, layering, transaksi, testing |
| 07 | [Roadmap](docs/07-roadmap.md) | Urutan implementasi bertahap + definition of done |

## Menjalankan fondasi lokal

```bash
docker compose up -d postgres
cp .env.example .env
npm install
npm run api:migrate
npm run api:seed
npm run api:dev
```

API tersedia di `http://localhost:3000/api/v1` dan dokumentasi Swagger di `http://localhost:3000/api/docs`.

## Mulai baca dari mana

**Kalau kamu baru di proyek ini**, baca berurutan: [00-overview](docs/00-overview.md) → [01-architecture](docs/01-architecture.md) → [03-data-model](docs/03-data-model.md). Tiga dokumen itu cukup untuk memahami sistem secara utuh.

**Kalau kamu mau langsung mengerjakan backend**: [03-data-model](docs/03-data-model.md) → [04-api-contract](docs/04-api-contract.md) → [06-backend-structure](docs/06-backend-structure.md).

**Kalau kamu mau langsung mengerjakan mobile**: [04-api-contract](docs/04-api-contract.md) → [05-mobile-app](docs/05-mobile-app.md).

**Kalau kamu mau tahu apa yang dikerjakan duluan**: [07-roadmap](docs/07-roadmap.md).

## Catatan

Diagram ditulis dengan [Mermaid](https://mermaid.js.org/) di dalam blok kode, sehingga langsung ter-render di GitHub dan di pratinjau markdown VS Code tanpa file gambar terpisah.
