import { z } from 'zod'

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL wajib diisi'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET minimal 32 karakter'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET minimal 32 karakter'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  SEED_OWNER_EMAIL: z.email().optional(),
  SEED_OWNER_PASSWORD: z.string().min(8).optional(),
  APP_TIMEZONE: z.string().default('Asia/Jakarta'),
})

export type Env = z.infer<typeof envSchema>

/**
 * Divalidasi saat boot. Aplikasi menolak start kalau ada yang kurang —
 * bukan crash di tengah jalan saat request pertama masuk.
 * Tidak ada nilai default untuk secret: secret yang punya fallback
 * pada akhirnya akan terbawa ke produksi.
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw)
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    throw new Error(`Konfigurasi environment tidak valid:\n${lines.join('\n')}`)
  }
  return result.data
}
