import { z } from 'zod'

export const loginSchema = z.object({
  email: z.email('Format email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
})
export type LoginInput = z.infer<typeof loginSchema>

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token wajib diisi'),
})
export type RefreshInput = z.infer<typeof refreshSchema>
