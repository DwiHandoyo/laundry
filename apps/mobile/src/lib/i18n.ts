import type { OrderStatus } from '@laundry/shared'

export const id = {
  app: { name: 'Laundry Outlet' },
  auth: {
    subtitle: 'Masuk untuk mengelola operasional outlet.',
    email: 'Email',
    password: 'Password',
    login: 'Masuk',
    logout: 'Keluar',
    loginFailed: 'Gagal masuk.',
  },
  common: { back: 'Kembali', save: 'Simpan' },
  tabs: { home: 'Beranda', orders: 'Pesanan', profile: 'Profil' },
  roles: { owner: 'Pemilik', staff: 'Staff' },
  home: {
    greeting: (name: string) => `Halo, ${name}`,
    subtitle: 'Pantau pesanan dan buat pesanan baru.',
    readyOrders: 'Siap Diambil',
    readyOrdersHint: 'Pesanan yang menunggu pelanggan.',
  },
  order: {
    create: 'Buat Pesanan',
  },
} as const

const labels: Record<OrderStatus, string> = {
  RECEIVED: 'Diterima',
  IN_PROGRESS: 'Dikerjakan',
  READY: 'Siap Diambil',
  COMPLETED: 'Selesai',
  CANCELLED: 'Dibatalkan',
}

export function orderStatusLabel(status: OrderStatus): string {
  return labels[status] ?? status
}
