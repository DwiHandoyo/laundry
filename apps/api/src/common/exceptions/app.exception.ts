/**
 * Katalog error domain.
 * Terpusat supaya pesan Bahasa Indonesia untuk staff hidup di satu tempat,
 * dan tidak ada `code` yang dipakai tanpa pesan pendampingnya.
 * Bentuk response-nya didefinisikan di docs/04-api-contract.md#format-error.
 */
export const ERROR_CATALOG = {
  VALIDATION_FAILED: { status: 400, message: 'Data yang dikirim tidak valid.' },
  INVALID_CREDENTIALS: { status: 401, message: 'Email atau password salah.' },
  TOKEN_EXPIRED: { status: 401, message: 'Sesi telah berakhir. Silakan masuk kembali.' },
  TOKEN_INVALID: { status: 401, message: 'Sesi tidak valid. Silakan masuk kembali.' },
  ACCOUNT_INACTIVE: { status: 403, message: 'Akun ini sudah dinonaktifkan.' },
  FORBIDDEN_ROLE: { status: 403, message: 'Anda tidak berwenang melakukan tindakan ini.' },
  RESOURCE_NOT_FOUND: { status: 404, message: 'Data tidak ditemukan.' },
  CUSTOMER_PHONE_TAKEN: { status: 409, message: 'Nomor HP sudah terdaftar atas pelanggan lain.' },
  SERVICE_CODE_TAKEN: { status: 409, message: 'Kode layanan sudah dipakai.' },
  USER_EMAIL_TAKEN: { status: 409, message: 'Email sudah terdaftar.' },
  SERVICE_INACTIVE: {
    status: 422,
    message: 'Ada layanan yang sudah tidak aktif dalam pesanan ini.',
  },
  ORDER_EMPTY_ITEMS: { status: 422, message: 'Pesanan harus memuat minimal satu item.' },
  ORDER_INVALID_TRANSITION: { status: 422, message: 'Perubahan status pesanan tidak diizinkan.' },
  ORDER_NOT_FULLY_PAID: {
    status: 422,
    message: 'Pesanan belum lunas dan tidak bisa diselesaikan.',
  },
  ORDER_ALREADY_FINAL: {
    status: 422,
    message: 'Pesanan sudah berstatus akhir dan tidak bisa diubah lagi.',
  },
  PAYMENT_EXCEEDS_TOTAL: { status: 422, message: 'Nominal pembayaran melebihi sisa tagihan.' },
  DISCOUNT_EXCEEDS_SUBTOTAL: { status: 422, message: 'Diskon melebihi subtotal pesanan.' },
  INTERNAL_ERROR: { status: 500, message: 'Terjadi kesalahan pada sistem.' },
} as const

export type ErrorCode = keyof typeof ERROR_CATALOG

export class AppException extends Error {
  readonly statusCode: number

  constructor(
    readonly code: ErrorCode,
    readonly details?: Record<string, unknown>,
    messageOverride?: string,
  ) {
    super(messageOverride ?? ERROR_CATALOG[code].message)
    this.name = 'AppException'
    this.statusCode = ERROR_CATALOG[code].status
  }
}
